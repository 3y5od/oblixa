import { headers } from "next/headers";
import { isSafeExtractionWorkerOrigin } from "@/lib/security/worker-url";
import {
  getCanonicalTrustedAppOriginFromEnv,
  isLocalOrigin,
  isProductionLikeOriginEnv,
  resolveTrustedOriginFromHeaders,
} from "@/lib/security/trusted-origin";
import { getTrustedPublicOriginFromRequest } from "@/lib/security/trusted-forwarded";

export { isLocalOrigin };

export function getCanonicalAppBaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  return getCanonicalTrustedAppOriginFromEnv(env);
}

/**
 * Base URL from env only — use for build-time or when no HTTP request exists
 * (e.g. some scripts). Prefer {@link resolveAppBaseUrl} or {@link getRequestOrigin} in requests.
 */
export function getAppBaseUrlFromEnv(): string {
  return getCanonicalAppBaseUrlFromEnv() ?? "http://localhost:3000";
}

/**
 * Origin for the current Route Handler request — correct for preview deployments,
 * custom domains, and local dev without relying on NEXT_PUBLIC_APP_URL.
 */
export function getRequestOrigin(request: Request): string {
  return getTrustedPublicOriginFromRequest(request);
}

/**
 * Origin for server-to-server calls to the extraction worker (`POST /api/extract/run`).
 * Set `EXTRACTION_WORKER_BASE_URL` to a stable public origin when the incoming request
 * host is not suitable (e.g. edge cases on some hosts). Otherwise uses the request URL origin.
 */
export function resolveExtractionWorkerOrigin(request: Request): string {
  const explicit = process.env.EXTRACTION_WORKER_BASE_URL?.trim();
  if (explicit) {
    const normalized = explicit.replace(/\/+$/, "");
    if (!isSafeExtractionWorkerOrigin(normalized)) {
      console.warn(
        "[app-url] EXTRACTION_WORKER_BASE_URL rejected as unsafe; using request origin"
      );
      return getRequestOrigin(request);
    }
    return normalized;
  }
  return getRequestOrigin(request);
}

/**
 * Origin for Server Actions and code without a Request — uses incoming Host headers
 * when available (Vercel preview/prod), then VERCEL_URL, then env default.
 */
export async function resolveAppBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const trusted = resolveTrustedOriginFromHeaders(h);
    if (trusted) return trusted;
  } catch {
    // headers() unavailable outside a request
  }
  const canonical = getCanonicalAppBaseUrlFromEnv();
  if (canonical) return canonical;
  if (isProductionLikeOriginEnv()) {
    throw new Error(
      "[app-url] Missing trusted app origin. Set NEXT_PUBLIC_APP_URL, APP_BASE_URL, VERCEL_PROJECT_PRODUCTION_URL, or OBLIXA_TRUSTED_APP_ORIGINS."
    );
  }
  return "http://localhost:3000";
}

export function getCanonicalServerBaseUrl(): string | null {
  return getCanonicalAppBaseUrlFromEnv();
}

/** @deprecated Use getAppBaseUrlFromEnv, resolveAppBaseUrl, or getRequestOrigin */
export function getAppBaseUrl(): string {
  return getAppBaseUrlFromEnv();
}
