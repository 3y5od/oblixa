import { headers } from "next/headers";

/**
 * Base URL from env only — use for build-time or when no HTTP request exists
 * (e.g. some scripts). Prefer {@link resolveAppBaseUrl} or {@link getRequestOrigin} in requests.
 */
export function getAppBaseUrlFromEnv(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * Origin for the current Route Handler request — correct for preview deployments,
 * custom domains, and local dev without relying on NEXT_PUBLIC_APP_URL.
 */
export function getRequestOrigin(request: Request): string {
  return new URL(request.url).origin.replace(/\/+$/, "");
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
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  } catch {
    // headers() unavailable outside a request
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const origin = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return origin.replace(/\/+$/, "");
  }
  return getAppBaseUrlFromEnv();
}

/** @deprecated Use getAppBaseUrlFromEnv, resolveAppBaseUrl, or getRequestOrigin */
export function getAppBaseUrl(): string {
  return getAppBaseUrlFromEnv();
}
