/**
 * Single place to derive public origin for absolute URLs (OAuth, email links).
 * In production-like environments, forwarded/host headers must resolve to an
 * origin configured through the app origin allowlist.
 */
import { isIP } from "node:net";
import {
  getCanonicalTrustedAppOriginFromEnv,
  isProductionLikeOriginEnv,
  normalizeAppOrigin,
  resolveTrustedOriginFromRequest,
} from "@/lib/security/trusted-origin";

const TRUST_FORWARDED_IP_ENV = "OBLIXA_TRUST_FORWARDED_IP";
const UNKNOWN_CLIENT_IP = "unknown";

function firstHeaderValue(value: string | null | undefined): string {
  return String(value ?? "")
    .split(",")[0]
    ?.trim() ?? "";
}

function normalizeForwardedClientIp(raw: string | null | undefined): string | null {
  let value = firstHeaderValue(raw);
  if (!value) return null;
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  if (/^::ffff:\d{1,3}(?:\.\d{1,3}){3}$/i.test(value)) {
    value = value.slice("::ffff:".length);
  }
  if (isIP(value) === 0) return null;

  const ipv4Parts = value.split(".");
  if (ipv4Parts.length === 4) {
    const nums = ipv4Parts.map((part) => Number(part));
    if (nums.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      return nums.join(".");
    }
    return null;
  }

  if (/^[0-9a-f:]+$/i.test(value) && value.includes(":")) {
    return value.toLowerCase();
  }

  return null;
}

export function isForwardedClientIpTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1" || env[TRUST_FORWARDED_IP_ENV] === "1";
}

export function requireTrustedClientIpConfigForProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (isProductionLikeOriginEnv(env) && !isForwardedClientIpTrusted(env)) {
    throw new Error(
      `[trusted-forwarded] Missing ${TRUST_FORWARDED_IP_ENV}=1 for non-Vercel production client IP derivation`
    );
  }
}

export function getTrustedClientIpFromHeaders(
  headers: Pick<Headers, "get">,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (!isForwardedClientIpTrusted(env)) {
    requireTrustedClientIpConfigForProduction(env);
    return UNKNOWN_CLIENT_IP;
  }
  return (
    normalizeForwardedClientIp(headers.get("x-forwarded-for")) ??
    normalizeForwardedClientIp(headers.get("x-real-ip")) ??
    UNKNOWN_CLIENT_IP
  );
}

export function getTrustedClientIpFromRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env
): string {
  return getTrustedClientIpFromHeaders(request.headers, env);
}

export function getTrustedPublicOriginFromRequest(request: Request): string {
  const trusted = resolveTrustedOriginFromRequest(request);
  if (trusted) return trusted;
  const canonical = getCanonicalTrustedAppOriginFromEnv();
  if (canonical) return canonical;
  if (isProductionLikeOriginEnv()) {
    throw new Error("[trusted-forwarded] Missing trusted public origin for absolute URL generation");
  }
  return normalizeAppOrigin(new URL(request.url).origin) ?? new URL(request.url).origin.replace(/\/+$/, "");
}
