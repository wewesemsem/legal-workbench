import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type UrlSafetyResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
  if (a !== undefined && a >= 224) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) {
      return isPrivateIpv4(mapped);
    }
  }
  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export function assertSafeHttpUrl(raw: string): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials_in_url" };
  }

  const hostname = url.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata"
  ) {
    return { ok: false, reason: "blocked_hostname" };
  }

  if (isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      return { ok: false, reason: "blocked_ip" };
    }
  }

  return { ok: true, url };
}

export async function assertSafeFetchTarget(raw: string): Promise<UrlSafetyResult> {
  const parsed = assertSafeHttpUrl(raw);
  if (!parsed.ok) {
    return parsed;
  }

  if (isIP(parsed.url.hostname)) {
    return parsed;
  }

  try {
    const records = await lookup(parsed.url.hostname, { all: true, verbatim: true });
    if (!records.length) {
      return { ok: false, reason: "dns_empty" };
    }
    for (const record of records) {
      if (isBlockedIpAddress(record.address)) {
        return { ok: false, reason: "blocked_resolved_ip" };
      }
    }
  } catch {
    return { ok: false, reason: "dns_failed" };
  }

  return parsed;
}
