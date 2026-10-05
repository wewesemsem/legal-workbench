import { Agent, fetch as undiciFetch } from "undici";

import { getEnv } from "@/lib/env";

type FetchOptions = {
  method?: "GET" | "HEAD" | "POST";
  timeoutMs?: number;
  headers?: Record<string, string>;
  body?: string;
  /**
   * Hostnames with incomplete public certificate chains where GET/POST is otherwise
   * publicly allowed. Hostname must already be allowlisted by the adapter.
   * This is NOT an access-control bypass — only TLS trust relaxation.
   */
  relaxTlsForHosts?: string[];
};

let lastRequestAt = 0;

/** Simple in-memory cookie jar keyed by registrable host. */
const cookieJar = new Map<string, Map<string, string>>();

const tlsRelaxedAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

async function throttle() {
  const env = getEnv();
  const minGap = env.LEGAL_CORPUS_REQUEST_DELAY_MS;
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < minGap) {
    await new Promise((resolve) => setTimeout(resolve, minGap - elapsed));
  }
  lastRequestAt = Date.now();
}

function hostKey(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function cookieHeaderFor(hostname: string): string | undefined {
  const jar = cookieJar.get(hostKey(hostname));
  if (!jar || jar.size === 0) {
    return undefined;
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function storeSetCookies(hostname: string, response: Response) {
  const key = hostKey(hostname);
  const jar = cookieJar.get(key) ?? new Map<string, string>();
  const anyHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [];
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) {
      jar.set(name, value);
    }
  }
  // Fallback: single set-cookie header
  const single = response.headers.get("set-cookie");
  if (setCookies.length === 0 && single) {
    const [pair] = single.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (pair && eq > 0) {
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  cookieJar.set(key, jar);
}

/**
 * Conservative single-flight fetch for corpus adapters.
 * No aggressive parallelism. Identifies the workbench politely.
 */
export async function corpusFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  await throttle();
  const env = getEnv();
  const parsed = new URL(url);
  const relaxHosts = new Set(
    (options.relaxTlsForHosts ?? []).map((host) => hostKey(host)),
  );
  const useRelaxedTls = relaxHosts.has(hostKey(parsed.hostname));

  const headers: Record<string, string> = {
    "User-Agent": env.LEGAL_CORPUS_USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
    ...(options.headers ?? {}),
  };
  const cookies = cookieHeaderFor(parsed.hostname);
  if (cookies) {
    headers.Cookie = cookies;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? env.LEGAL_CORPUS_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await undiciFetch(url, {
      method: options.method ?? "GET",
      redirect: "follow",
      signal: controller.signal,
      headers,
      body: options.body,
      dispatcher: useRelaxedTls ? tlsRelaxedAgent : undefined,
    });
    storeSetCookies(parsed.hostname, response as unknown as Response);
    // undici Response is compatible enough for callers using .ok/.status/.text/.arrayBuffer
    return response as unknown as Response;
  } finally {
    clearTimeout(timeout);
  }
}

export function resetCorpusFetchThrottleForTests() {
  lastRequestAt = 0;
  cookieJar.clear();
}

export function assertAllowedHostname(url: string, allowedHosts: string[]) {
  const hostname = hostKey(new URL(url).hostname);
  const allowed = allowedHosts.map((host) => hostKey(host));
  if (!allowed.includes(hostname)) {
    throw new Error(
      `URL host "${hostname}" is outside adapter crawl boundary (${allowed.join(", ")})`,
    );
  }
  return hostname;
}

export async function inspectRobotsTxt(input: {
  origin: string;
  allowedHosts: string[];
  relaxTlsForHosts?: string[];
}): Promise<{
  fetched: boolean;
  status?: number;
  disallowsAll?: boolean;
  raw?: string;
  note: string;
}> {
  try {
    assertAllowedHostname(input.origin, input.allowedHosts);
    const robotsUrl = new URL("/robots.txt", input.origin).toString();
    const response = await corpusFetch(robotsUrl, {
      method: "GET",
      relaxTlsForHosts: input.relaxTlsForHosts,
    });
    if (response.status === 404) {
      return {
        fetched: true,
        status: 404,
        note: "robots.txt not found; proceeding with conservative public GET/POST only",
      };
    }
    if (!response.ok) {
      return {
        fetched: true,
        status: response.status,
        note: `robots.txt HTTP ${response.status}; treating as unknown and staying conservative`,
      };
    }
    const raw = await response.text();
    const disallowsAll = /^\s*User-agent:\s*\*\s*$/im.test(raw)
      ? /Disallow:\s*\/\s*$/im.test(raw)
      : false;
    return {
      fetched: true,
      status: response.status,
      disallowsAll,
      raw: raw.slice(0, 4_000),
      note: disallowsAll
        ? "robots.txt disallows all automated agents"
        : "robots.txt inspected; no blanket disallow detected for *",
    };
  } catch (error) {
    return {
      fetched: false,
      note:
        error instanceof Error
          ? `robots.txt probe failed: ${error.message}`
          : "robots.txt probe failed",
    };
  }
}

export function detectAccessRestriction(input: {
  status: number;
  body: string;
  finalUrl?: string;
}): {
  restricted: boolean;
  category?: "ACCESS_RESTRICTED" | "NETWORK_ERROR";
  reason?: string;
  accessStatus?:
    | "ACCESS_RESTRICTED"
    | "AUTHENTICATION_REQUIRED"
    | "RATE_LIMITED"
    | "NOT_FOUND"
    | "ERROR";
} {
  if (input.status === 401) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "HTTP 401 authentication required",
      accessStatus: "AUTHENTICATION_REQUIRED",
    };
  }
  if (input.status === 403) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "HTTP 403 forbidden",
      accessStatus: "ACCESS_RESTRICTED",
    };
  }
  if (input.status === 404) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "HTTP 404 not found",
      accessStatus: "NOT_FOUND",
    };
  }
  if (input.status === 429) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "HTTP 429 rate limited",
      accessStatus: "RATE_LIMITED",
    };
  }
  if (input.status >= 500) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: `HTTP ${input.status} server error`,
      accessStatus: "ERROR",
    };
  }
  if (!input.status || input.status < 200 || input.status >= 400) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: `HTTP ${input.status}`,
      accessStatus: "ERROR",
    };
  }

  if (input.finalUrl && /aspxerrorpath=/i.test(input.finalUrl)) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "Server redirected to ASP.NET error path",
      accessStatus: "ERROR",
    };
  }

  // Avoid false positives from CDN hostnames like cdnjs.cloudflare.com.
  const challengePatterns: Array<[RegExp, string]> = [
    [/aspxerrorpath=/i, "aspxerrorpath"],
    [/g-recaptcha/i, "g-recaptcha"],
    [/\brecaptcha\b/i, "recaptcha"],
    [/hcaptcha/i, "hcaptcha"],
    [/cf-challenge/i, "cf-challenge"],
    [/cdn-cgi\/challenge/i, "cdn-cgi/challenge"],
    [/attention required/i, "attention required"],
    [/just a moment\.\.\./i, "just a moment"],
  ];
  for (const [pattern, label] of challengePatterns) {
    if (pattern.test(input.body)) {
      return {
        restricted: true,
        category: "ACCESS_RESTRICTED",
        reason: `Anti-bot/error interstitial detected (${label})`,
        accessStatus: "ACCESS_RESTRICTED",
      };
    }
  }

  if (
    /\bcaptcha\b/i.test(input.body) &&
    /challenge|verify you are human|أنا لست روبوت/i.test(input.body)
  ) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "CAPTCHA challenge detected",
      accessStatus: "ACCESS_RESTRICTED",
    };
  }

  if (
    /Server Error/i.test(input.body) &&
    /File or directory not found|Runtime Error|aspxerrorpath/i.test(input.body)
  ) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "Server error page detected",
      accessStatus: "ERROR",
    };
  }

  if (
    /تسجيل الدخول|log\s*in|sign\s*in|subscription|اشتراك|paywall/i.test(
      input.body,
    ) &&
    input.body.length < 20_000
  ) {
    return {
      restricted: true,
      category: "ACCESS_RESTRICTED",
      reason: "Login/subscription wall detected",
      accessStatus: "AUTHENTICATION_REQUIRED",
    };
  }

  return { restricted: false };
}
