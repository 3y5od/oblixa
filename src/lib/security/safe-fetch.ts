import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import net from "node:net";
import { Agent, type Dispatcher } from "undici";

export type SafeFetchInit = RequestInit & {
  /** Abort after ms (defaults 15000). */
  timeoutMs?: number;
  /** Allow localhost/loopback only in non-production dev for same-app internal hops. */
  allowLocalhostInDev?: boolean;
};

type SafeFetchRequestInit = RequestInit & { dispatcher?: Dispatcher };
type PinnedDnsLookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;
type PinnedDnsLookupOptions = { all?: boolean } | number | undefined;

export const SAFE_FETCH_DEFAULT_TIMEOUT_MS = 15_000;
export const SAFE_FETCH_MAX_TIMEOUT_MS = 30_000;

function isProductionLike(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((parts[0]! << 24) >>> 0) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
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

function stripIpv6Brackets(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function parseIpv6Hextets(ip: string): number[] | null {
  let input = stripIpv6Brackets(ip);
  if (!net.isIPv6(input) || input.includes("%")) return null;

  const embeddedIpv4 = input.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  const ipv4Hextets: number[] = [];
  if (embeddedIpv4) {
    const v4 = ipv4ToInt(embeddedIpv4[2]!);
    if (v4 === null) return null;
    ipv4Hextets.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
    input = embeddedIpv4[1]!.replace(/:$/, "");
  }

  const parts = input.split("::");
  if (parts.length > 2) return null;
  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const hextets = part.split(":");
    const parsed = hextets.map((segment) => Number.parseInt(segment, 16));
    if (
      parsed.some(
        (segment, index) =>
          !Number.isInteger(segment) ||
          segment < 0 ||
          segment > 0xffff ||
          !/^[0-9a-f]{1,4}$/i.test(hextets[index] ?? "")
      )
    ) {
      return null;
    }
    return parsed;
  };

  const left = parsePart(parts[0] ?? "");
  const right = parsePart(parts[1] ?? "");
  if (!left || !right) return null;
  if (parts.length === 1) {
    const exact = [...left, ...ipv4Hextets];
    return exact.length === 8 ? exact : null;
  }

  const missing = 8 - left.length - right.length - ipv4Hextets.length;
  if (missing < 0) return null;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right, ...ipv4Hextets];
}

function ipv6MatchesPrefix(ip: string, prefix: string, bits: number): boolean {
  const ipHextets = parseIpv6Hextets(ip);
  const prefixHextets = parseIpv6Hextets(prefix);
  if (!ipHextets || !prefixHextets || bits < 0 || bits > 128) return false;

  let remaining = bits;
  for (let i = 0; i < 8 && remaining > 0; i += 1) {
    const compareBits = Math.min(remaining, 16);
    const mask = compareBits === 16 ? 0xffff : (0xffff << (16 - compareBits)) & 0xffff;
    if ((ipHextets[i]! & mask) !== (prefixHextets[i]! & mask)) return false;
    remaining -= compareBits;
  }
  return true;
}

/** Returns true if IP string should not be reached from server-side fetch (SSRF guard). */
export function isBlockedOutboundIp(ip: string): boolean {
  const normalized = stripIpv6Brackets(ip);
  if (!normalized) return true;
  if (net.isIPv4(normalized)) return isBlockedOutboundIpv4(normalized);
  if (!net.isIPv6(normalized)) return true;
  if (ipv6MatchesPrefix(normalized, "::", 128)) return true;
  if (ipv6MatchesPrefix(normalized, "::1", 128)) return true;
  if (ipv6MatchesPrefix(normalized, "::ffff:0:0", 96)) return true;
  if (ipv6MatchesPrefix(normalized, "::", 96)) return true;
  if (ipv6MatchesPrefix(normalized, "64:ff9b::", 96)) return true;
  if (ipv6MatchesPrefix(normalized, "100::", 64)) return true;
  if (ipv6MatchesPrefix(normalized, "2001:2::", 48)) return true;
  if (ipv6MatchesPrefix(normalized, "2001:10::", 28)) return true;
  if (ipv6MatchesPrefix(normalized, "2001:20::", 28)) return true;
  if (ipv6MatchesPrefix(normalized, "2001:db8::", 32)) return true;
  if (ipv6MatchesPrefix(normalized, "2002::", 16)) return true;
  if (ipv6MatchesPrefix(normalized, "3fff::", 20)) return true;
  if (ipv6MatchesPrefix(normalized, "fc00::", 7)) return true;
  if (ipv6MatchesPrefix(normalized, "fe80::", 10)) return true;
  if (ipv6MatchesPrefix(normalized, "ff00::", 8)) return true;
  return false;
}

function hostnameLooksSafe(hostname: string): boolean {
  const h = stripIpv6Brackets(hostname);
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (net.isIPv4(h)) return !isBlockedOutboundIpv4(h);
  if (net.isIPv6(h)) return !isBlockedOutboundIp(h);
  return true;
}

export function isAllowedDevLocalhostUrl(url: URL, env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionLike(env)) return false;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1";
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

function normalizeSafeFetchTimeoutMs(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return SAFE_FETCH_DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("safeFetch: invalid timeout");
  }
  return Math.min(Math.floor(timeoutMs), SAFE_FETCH_MAX_TIMEOUT_MS);
}

export function createPinnedDnsLookupForSafeFetch(addresses: LookupAddress[]) {
  const pinned = addresses.map((entry) => ({ address: entry.address, family: entry.family }));
  return (_hostname: string, options: PinnedDnsLookupOptions, callback: PinnedDnsLookupCallback) => {
    const first = pinned[0];
    if (!first) {
      const error = new Error("safeFetch: no pinned addresses") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      callback(error, "", 0);
      return;
    }
    if (typeof options === "object" && options?.all) {
      callback(null, pinned);
      return;
    }
    callback(null, first.address, first.family);
  };
}

function createPinnedDispatcherForSafeFetch(addresses: LookupAddress[]): Dispatcher {
  return new Agent({
    keepAliveTimeout: 1,
    keepAliveMaxTimeout: 1,
    connect: {
      lookup: createPinnedDnsLookupForSafeFetch(addresses),
    },
  });
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
  const { timeoutMs: explicitTimeout, allowLocalhostInDev = false, ...rest } = init;
  const hostname = stripIpv6Brackets(url.hostname);
  const allowDevLocalhost = allowLocalhostInDev && isAllowedDevLocalhostUrl(url);
  if (!allowDevLocalhost && !hostnameLooksSafe(hostname)) {
    throw new Error("safeFetch: disallowed host");
  }

  const timeoutMs = explicitTimeout ?? SAFE_FETCH_DEFAULT_TIMEOUT_MS;
  const boundedTimeoutMs = normalizeSafeFetchTimeoutMs(timeoutMs);
  if (rest.redirect && rest.redirect !== "manual") {
    throw new Error("safeFetch: redirect following is disabled");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeoutMs);

  try {
    const signal = combineSignals(rest.signal ?? undefined, controller.signal);
    let pinnedAddresses: LookupAddress[] | null = null;
    if (!allowDevLocalhost) {
      const lookup = await dns.lookup(hostname, { all: true, verbatim: true });
      if (lookup.length === 0) throw new Error("safeFetch: no addresses");
      for (const { address } of lookup) {
        if (isBlockedOutboundIp(address)) {
          throw new Error(`safeFetch: resolved to blocked IP ${address}`);
        }
      }
      pinnedAddresses = lookup;
    }
    const dispatcher = pinnedAddresses ? createPinnedDispatcherForSafeFetch(pinnedAddresses) : undefined;
    const fetchInit: SafeFetchRequestInit = { ...rest, redirect: "manual", signal };
    if (dispatcher) fetchInit.dispatcher = dispatcher;
    const response = await fetch(url, fetchInit as RequestInit);
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      throw new Error("safeFetch: redirect response blocked");
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}
