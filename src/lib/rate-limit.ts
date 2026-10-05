type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Simple in-memory fixed-window rate limiter for auth endpoints.
 * Suitable for single-instance Phase 1 foundation; replace with Redis later if needed.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - 1),
      resetAt,
    };
  }

  if (existing.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - existing.count),
    resetAt: existing.resetAt,
  };
}

export function resetRateLimitStoreForTests() {
  store.clear();
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return headers.get("x-real-ip") || "unknown";
}
