import { headers } from "next/headers";
import { isSafeExtractionWorkerOrigin } from "@/lib/security/worker-url";

function normalizeOrigin(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function isProductionLike(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || String(env.VERCEL_ENV ?? "").trim() === "production";
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getCanonicalAppBaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw =
    env.NEXT_PUBLIC_APP_URL?.trim() || env.APP_BASE_URL?.trim() || env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || "";
  if (!raw) return isProductionLike(env) ? null : "http://localhost:3000";
  const origin = normalizeOrigin(raw.startsWith("http") ? raw : `https://${raw}`);
  if (isProductionLike(env) && isLocalOrigin(origin)) return null;
  return origin;
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
  return normalizeOrigin(new URL(request.url).origin);
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
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return normalizeOrigin(`${proto}://${host}`);
    }
  } catch {
    // headers() unavailable outside a request
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const origin = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return normalizeOrigin(origin);
  }
  return getAppBaseUrlFromEnv();
}

export function getCanonicalServerBaseUrl(): string | null {
  return getCanonicalAppBaseUrlFromEnv();
}

/** @deprecated Use getAppBaseUrlFromEnv, resolveAppBaseUrl, or getRequestOrigin */
export function getAppBaseUrl(): string {
  return getAppBaseUrlFromEnv();
}
