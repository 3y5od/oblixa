import { headers } from "next/headers";

/**
 * Base URL for server-side calls to this app's own Route Handlers (e.g. /api/extract).
 * Uses the incoming request host when available so local dev hits localhost even if
 * NEXT_PUBLIC_APP_URL is set to a production URL.
 */
export async function getInternalAppUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]");
    const proto =
      h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  return "http://localhost:3000";
}
