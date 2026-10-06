import { getEnv } from "@/lib/env";
import {
  LLM_PROVIDER_LABELS,
  type LlmModelOption,
  type LlmProviderCatalog,
  type LlmProviderId,
} from "@/modules/llm/types";

const OPENAI_NON_CHAT =
  /(embed|whisper|tts|dall-e|realtime|audio|image|transcribe|moderation|computer-use|sora|codex-mini)/i;

const GEMINI_NON_CHAT =
  /(tts|audio|image|imagen|embed|veo|live|transcribe|robotics|computer-use|native-audio|preview-image)/i;

/** Max models shown in the multi-LLM picker per provider. */
export const LLM_PICKER_MODEL_LIMIT = 3;

/** How long a live catalog stays warm in-process. */
const CATALOG_TTL_MS = 30 * 60 * 1000;
/** Don't let a slow vendor block the picker. */
const MODEL_LIST_TIMEOUT_MS = 2_500;

type CatalogPayload = {
  defaultProvider: LlmProviderId | null;
  providers: LlmProviderCatalog[];
};

let catalogCache: { key: string; expiresAt: number; value: CatalogPayload } | null =
  null;

function catalogCacheKey() {
  return listSelectableProviders().join(",");
}

function envFallbackModels(provider: LlmProviderId): LlmModelOption[] {
  const env = getEnv();
  const id =
    provider === "openai"
      ? env.OPENAI_MODEL
      : provider === "anthropic"
        ? env.ANTHROPIC_MODEL
        : provider === "gemini"
          ? env.GEMINI_MODEL
          : null;
  if (!id) return [];
  return [{ id, label: humanizeModelId(id), createdAt: null }];
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit | undefined,
  timeoutMs = MODEL_LIST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function humanizeModelId(id: string) {
  return id
    .replace(/^models\//, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isLlmProviderConfigured(provider: LlmProviderId): boolean {
  const env = getEnv();
  switch (provider) {
    case "mock":
      return true;
    case "openai":
      return Boolean(env.OPENAI_API_KEY?.trim());
    case "anthropic":
      return Boolean(env.ANTHROPIC_API_KEY?.trim());
    case "gemini":
      return Boolean(env.GEMINI_API_KEY?.trim());
    default:
      return false;
  }
}

export function listSelectableProviders(): LlmProviderId[] {
  const providers: LlmProviderId[] = [];
  for (const provider of ["openai", "anthropic", "gemini"] as const) {
    if (isLlmProviderConfigured(provider)) {
      providers.push(provider);
    }
  }
  return providers;
}

export function resolveDefaultSelectableProvider(): LlmProviderId | null {
  const env = getEnv();
  const providers = listSelectableProviders();
  if (providers.includes(env.LLM_PROVIDER as LlmProviderId)) {
    return env.LLM_PROVIDER as LlmProviderId;
  }
  return providers[0] ?? null;
}

function pickLatestOpenAi(models: LlmModelOption[], fallback: string) {
  // Caller already limited/sorted newest-first for the picker.
  const flagship = models.find(
    (model) => !/(mini|nano|small|preview)/i.test(model.id),
  );
  return flagship?.id ?? models[0]?.id ?? fallback;
}

function pickLatestAnthropic(models: LlmModelOption[], fallback: string) {
  // Anthropic lists more recently released models first.
  return models[0]?.id ?? fallback;
}

function geminiVersionScore(id: string) {
  const match = id.match(/gemini-(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : 0;
}

function pickLatestGemini(models: LlmModelOption[], fallback: string) {
  const ranked = [...models].sort((a, b) => {
    const versionDelta = geminiVersionScore(b.id) - geminiVersionScore(a.id);
    if (versionDelta !== 0) {
      return versionDelta;
    }
    const aPro = /pro/i.test(a.id) ? 1 : 0;
    const bPro = /pro/i.test(b.id) ? 1 : 0;
    if (aPro !== bPro) {
      return bPro - aPro;
    }
    return a.id.localeCompare(b.id);
  });
  return ranked[0]?.id ?? fallback;
}

export function pickLatestModel(
  provider: LlmProviderId,
  models: LlmModelOption[],
): string | null {
  const env = getEnv();
  switch (provider) {
    case "mock":
      return "mock-matter-chat";
    case "openai":
      return pickLatestOpenAi(models, env.OPENAI_MODEL);
    case "anthropic":
      return pickLatestAnthropic(models, env.ANTHROPIC_MODEL);
    case "gemini":
      return pickLatestGemini(models, env.GEMINI_MODEL);
    default:
      return null;
  }
}

/** Keep only the newest N chat models for the picker UI. */
export function limitModelsForPicker(
  provider: LlmProviderId,
  models: LlmModelOption[],
  limit = LLM_PICKER_MODEL_LIMIT,
): LlmModelOption[] {
  if (provider === "openai") {
    const sorted = [...models].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    );
    return sorted.slice(0, limit);
  }
  if (provider === "gemini") {
    // Already sorted in fetchGeminiModels (newest chat models first).
    return models.slice(0, limit);
  }
  // Anthropic (and others): already newest-first from the API.
  return models.slice(0, limit);
}

async function fetchOpenAiModels(): Promise<LlmModelOption[]> {
  const env = getEnv();
  const response = await fetchWithTimeout(`${env.OPENAI_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`OpenAI models list failed (${response.status})`);
  }
  const payload = (await response.json()) as {
    data?: Array<{ id?: string; created?: number }>;
  };
  return (payload.data ?? [])
    .filter(
      (model): model is { id: string; created?: number } =>
        typeof model.id === "string" &&
        /^(gpt-|o\d|chatgpt-)/i.test(model.id) &&
        !OPENAI_NON_CHAT.test(model.id),
    )
    .map((model) => ({
      id: model.id,
      label: humanizeModelId(model.id),
      createdAt: model.created ?? null,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

async function fetchAnthropicModels(): Promise<LlmModelOption[]> {
  const env = getEnv();
  const response = await fetchWithTimeout(`${env.ANTHROPIC_BASE_URL}/v1/models`, {
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) {
    throw new Error(`Anthropic models list failed (${response.status})`);
  }
  const payload = (await response.json()) as {
    data?: Array<{ id?: string; display_name?: string; created_at?: string }>;
  };
  return (payload.data ?? [])
    .filter((model): model is { id: string; display_name?: string; created_at?: string } =>
      typeof model.id === "string" && model.id.startsWith("claude-"),
    )
    .map((model) => ({
      id: model.id,
      label: model.display_name || humanizeModelId(model.id),
      createdAt: model.created_at
        ? Math.floor(new Date(model.created_at).getTime() / 1000)
        : null,
    }));
}

async function fetchGeminiModels(): Promise<LlmModelOption[]> {
  const env = getEnv();
  const url = new URL(`${env.GEMINI_BASE_URL}/models`);
  url.searchParams.set("key", env.GEMINI_API_KEY ?? "");
  url.searchParams.set("pageSize", "100");
  const response = await fetchWithTimeout(url, undefined);
  if (!response.ok) {
    throw new Error(`Gemini models list failed (${response.status})`);
  }
  const payload = (await response.json()) as {
    models?: Array<{
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
  };
  return (payload.models ?? [])
    .filter((model) => {
      if (!model.name) {
        return false;
      }
      if (!model.supportedGenerationMethods?.includes("generateContent")) {
        return false;
      }
      if (!/gemini/i.test(model.name)) {
        return false;
      }
      const id = model.name.replace(/^models\//, "");
      // Chat picker only — exclude TTS / image / audio specialty models.
      if (GEMINI_NON_CHAT.test(id)) {
        return false;
      }
      return true;
    })
    .map((model) => {
      const id = (model.name ?? "").replace(/^models\//, "");
      return {
        id,
        label: model.displayName || humanizeModelId(id),
        createdAt: null,
      };
    })
    .sort((a, b) => {
      const versionDelta = geminiVersionScore(b.id) - geminiVersionScore(a.id);
      if (versionDelta !== 0) {
        return versionDelta;
      }
      const aPro = /pro/i.test(a.id) ? 1 : 0;
      const bPro = /pro/i.test(b.id) ? 1 : 0;
      if (aPro !== bPro) {
        return bPro - aPro;
      }
      // Prefer plain flash/pro IDs over -lite / specialty variants.
      const aLite = /lite|customtools|preview/i.test(a.id) ? 1 : 0;
      const bLite = /lite|customtools|preview/i.test(b.id) ? 1 : 0;
      if (aLite !== bLite) {
        return aLite - bLite;
      }
      return a.id.localeCompare(b.id);
    });
}

async function listModelsForProvider(
  provider: LlmProviderId,
): Promise<LlmModelOption[]> {
  switch (provider) {
    case "mock":
      return [
        {
          id: "mock-matter-chat",
          label: "Mock matter chat",
          createdAt: null,
        },
      ];
    case "openai":
      return fetchOpenAiModels();
    case "anthropic":
      return fetchAnthropicModels();
    case "gemini":
      return fetchGeminiModels();
    default:
      return [];
  }
}

export async function getLlmCatalog(options?: {
  bypassCache?: boolean;
}): Promise<CatalogPayload> {
  const key = catalogCacheKey();
  if (
    !options?.bypassCache &&
    catalogCache &&
    catalogCache.key === key &&
    catalogCache.expiresAt > Date.now()
  ) {
    return catalogCache.value;
  }

  const env = getEnv();
  const providerIds = listSelectableProviders();

  const providers = await Promise.all(
    providerIds.map(async (id) => {
      const configured = isLlmProviderConfigured(id);
      if (!configured) {
        return {
          id,
          label: LLM_PROVIDER_LABELS[id],
          configured: false,
          latestModelId: null,
          models: [],
          error: "API key not configured",
        } satisfies LlmProviderCatalog;
      }

      try {
        const models = limitModelsForPicker(
          id,
          await listModelsForProvider(id),
        );
        return {
          id,
          label: LLM_PROVIDER_LABELS[id],
          configured: true,
          latestModelId: pickLatestModel(id, models),
          models,
        } satisfies LlmProviderCatalog;
      } catch (error) {
        const fallback = envFallbackModels(id);
        return {
          id,
          label: LLM_PROVIDER_LABELS[id],
          configured: true,
          latestModelId: fallback[0]?.id ?? null,
          models: fallback,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load live model list",
        } satisfies LlmProviderCatalog;
      }
    }),
  );

  const value: CatalogPayload = {
    defaultProvider: resolveDefaultSelectableProvider(),
    providers,
  };
  catalogCache = {
    key,
    expiresAt: Date.now() + CATALOG_TTL_MS,
    value,
  };
  return value;
}

export async function resolveLlmSelection(input: {
  provider?: string | null;
  model?: string | null;
}): Promise<{ provider: LlmProviderId; model: string }> {
  const env = getEnv();
  const allowed = listSelectableProviders();
  const requested = input.provider?.trim() as LlmProviderId | undefined;
  const provider =
    (requested && allowed.includes(requested) ? requested : null) ??
    resolveDefaultSelectableProvider();

  if (!provider) {
    throw new Error(
      "No live LLM provider is configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.",
    );
  }

  if (!isLlmProviderConfigured(provider)) {
    throw new Error(`${LLM_PROVIDER_LABELS[provider]} is not configured`);
  }

  const requestedModel = input.model?.trim() || "";
  if (requestedModel && requestedModel !== "latest") {
    return { provider, model: requestedModel };
  }

  // Use the warm catalog cache (or env fallback) — never block chat on a fresh
  // vendor models list when the user already picked "Latest".
  try {
    const catalog = await getLlmCatalog();
    const entry = catalog.providers.find((item) => item.id === provider);
    if (entry?.latestModelId) {
      return { provider, model: entry.latestModelId };
    }
  } catch {
    // Fall through to env defaults.
  }

  if (provider === "openai") {
    return { provider, model: env.OPENAI_MODEL };
  }
  if (provider === "anthropic") {
    return { provider, model: env.ANTHROPIC_MODEL };
  }
  return { provider, model: env.GEMINI_MODEL };
}
