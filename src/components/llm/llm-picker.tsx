"use client";

import { useEffect, useMemo, useState } from "react";

import type { LlmProviderCatalog, LlmProviderId } from "@/modules/llm/types";

const STORAGE_KEY = "lawyer-workbench.llm-selection";
const CATALOG_STORAGE_KEY = "lawyer-workbench.llm-catalog";

export type LlmPickerSelection = {
  provider: Exclude<LlmProviderId, "mock">;
  /** Empty or "latest" resolves to the provider's dynamically picked latest model. */
  model: string;
};

type CatalogResponse = {
  defaultProvider: Exclude<LlmProviderId, "mock"> | null;
  providers: LlmProviderCatalog[];
};

function readStoredSelection(): LlmPickerSelection | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<LlmPickerSelection>;
    if (
      parsed.provider === "openai" ||
      parsed.provider === "anthropic" ||
      parsed.provider === "gemini"
    ) {
      return {
        provider: parsed.provider,
        model: typeof parsed.model === "string" ? parsed.model : "latest",
      };
    }
  } catch {
    // Ignore bad local storage.
  }
  return null;
}

function readCachedCatalog(): CatalogResponse | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogResponse;
    if (!Array.isArray(parsed.providers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedCatalog(catalog: CatalogResponse) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function applyPreferredSelection(
  catalog: CatalogResponse,
  onChange: (next: LlmPickerSelection) => void,
) {
  const stored = readStoredSelection();
  const available = catalog.providers.filter((provider) => provider.configured);
  const preferred =
    available.find((provider) => provider.id === stored?.provider) ??
    available.find((provider) => provider.id === catalog.defaultProvider) ??
    available[0];

  if (preferred && preferred.id !== "mock") {
    const modelStillValid =
      stored?.model === "latest" ||
      preferred.models.some((model) => model.id === stored?.model);
    onChange({
      provider: preferred.id,
      model:
        stored && modelStillValid
          ? stored.model
          : preferred.latestModelId
            ? "latest"
            : preferred.models[0]?.id || "latest",
    });
  }
}

export function LlmPicker({
  value,
  onChange,
}: {
  value: LlmPickerSelection;
  onChange: (next: LlmPickerSelection) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const initial = readCachedCatalog();
    if (initial) {
      setCatalog(initial);
      setLoading(false);
      applyPreferredSelection(initial, onChange);
    }

    async function load() {
      if (!initial) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch("/api/llm/models", {
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message ?? "Unable to load models");
        }
        if (cancelled) {
          return;
        }
        const nextCatalog = data as CatalogResponse;
        writeCachedCatalog(nextCatalog);
        setCatalog(nextCatalog);
        applyPreferredSelection(nextCatalog, onChange);
      } catch (err) {
        if (!cancelled && !initial) {
          setError(
            err instanceof Error ? err.message : "Unable to load models",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount; parent owns selection thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }, [value]);

  const activeProvider = useMemo(
    () => catalog?.providers.find((provider) => provider.id === value.provider),
    [catalog, value.provider],
  );

  const modelOptions = useMemo(() => {
    const models = activeProvider?.models ?? [];
    const latestId = activeProvider?.latestModelId;
    return [
      {
        id: "latest",
        label: latestId ? `Latest (${latestId})` : "Latest (auto)",
      },
      ...models.filter((model) => model.id !== "latest"),
    ];
  }, [activeProvider]);

  if (loading && !catalog) {
    return (
      <div className="text-xs text-stone-500" aria-live="polite">
        Loading models…
      </div>
    );
  }

  if (error || !catalog?.providers.length) {
    return (
      <div className="text-xs text-amber-700" role="status">
        {error ?? "No LLM providers configured"}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-stone-500">
          Provider
        </span>
        <select
          value={value.provider}
          onChange={(event) => {
            const provider = event.target.value as Exclude<
              LlmProviderId,
              "mock"
            >;
            onChange({
              provider,
              model: "latest",
            });
          }}
          className="auth-input min-w-[9rem] py-1.5 text-sm"
        >
          {catalog.providers.map((provider) => (
            <option
              key={provider.id}
              value={provider.id}
              disabled={!provider.configured}
            >
              {provider.label}
              {!provider.configured ? " (needs key)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-stone-500">
          Model
        </span>
        <select
          value={value.model}
          onChange={(event) =>
            onChange({
              provider: value.provider,
              model: event.target.value,
            })
          }
          className="auth-input min-w-[14rem] py-1.5 text-sm"
          disabled={!activeProvider?.configured}
        >
          {modelOptions.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </label>

      {activeProvider?.error && activeProvider.models.length === 0 ? (
        <p className="basis-full text-[11px] text-amber-700">
          Live catalog unavailable — using fallback model list.
        </p>
      ) : null}
    </div>
  );
}
