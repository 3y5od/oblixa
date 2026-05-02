import dns from "node:dns/promises";
import net from "node:net";

export type SafeFetchInit = RequestInit & {
  /** Abort after ms (defaults 15000). */
  timeoutMs?: number;
};

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!;
}

/** Returns true if IPv4 should not be reached from server-side fetch (SSRF guard). */
export function isBlockedOutboundIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  const inRange = (base: string, bits: number) => {
    const bn = ipv4ToInt(base);
    if (bn === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (bn & mask);
  };
  if (inRange("0.0.0.0", 8)) return true;
  if (inRange("10.0.0.0", 8)) return true;
  if (inRange("127.0.0.0", 8)) return true;
  if (inRange("169.254.0.0", 16)) return true;
  if (inRange("172.16.0.0", 12)) return true;
  if (inRange("192.168.0.0", 16)) return true;
  if (inRange("100.64.0.0", 10)) return true;
  if (inRange("192.0.0.0", 24)) return true;
  if (inRange("192.0.2.0", 24)) return true;
  if (inRange("198.18.0.0", 15)) return true;
  if (inRange("198.51.100.0", 24)) return true;
  if (inRange("203.0.113.0", 24)) return true;
  if (inRange("224.0.0.0", 4)) return true;
  if (inRange("240.0.0.0", 4)) return true;
  return false;
}

/** Returns true if IP string should not be reached from server-side fetch (SSRF guard). */
export function isBlockedOutboundIp(ip: string): boolean {
  if (!ip) return true;
  if (net.isIPv4(ip)) return isBlockedOutboundIpv4(ip);
  if (!net.isIPv6(ip)) return true;
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("::ffff:")) {
    const tail = lower.slice(7);
    if (net.isIPv4(tail)) return isBlockedOutboundIpv4(tail);
  }
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("ff")) return true;
  return false;
}

function hostnameLooksSafe(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (net.isIPv4(h)) return !isBlockedOutboundIpv4(h);
  if (net.isIPv6(h)) return !isBlockedOutboundIp(h);
  return true;
}

function combineSignals(user: AbortSignal | null | undefined, inner: AbortSignal): AbortSignal {
  if (!user) return inner;
  const c = new AbortController();
  const onAbort = () => c.abort();
  if (user.aborted) {
    c.abort();
    return c.signal;
  }
  user.addEventListener("abort", onAbort, { once: true });
  inner.addEventListener("abort", onAbort, { once: true });
  return c.signal;
}

/**
 * Fetch only http(s) URLs whose resolved addresses are not private/metadata ranges.
 * Throws on policy violation or blocked resolution.
 */
export async function safeFetch(input: string | URL, init: SafeFetchInit = {}): Promise<Response> {
  const url = typeof input === "string" ? new URL(input) : new URL(input.href);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`safeFetch: disallowed protocol ${url.protocol}`);
  }
  if (!hostnameLooksSafe(url.hostname)) {
    throw new Error("safeFetch: disallowed host");
  }

  const { timeoutMs: explicitTimeout, ...rest } = init;
  const timeoutMs = explicitTimeout ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const lookup = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (lookup.length === 0) throw new Error("safeFetch: no addresses");
    for (const { address } of lookup) {
      if (isBlockedOutboundIp(address)) {
        throw new Error(`safeFetch: resolved to blocked IP ${address}`);
      }
    }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }

  const signal = combineSignals(rest.signal ?? undefined, controller.signal);
  try {
    return await fetch(url, { ...rest, signal });
  } finally {
    clearTimeout(timer);
  }
}
