/**
 * Single place to derive public origin for absolute URLs (OAuth, email links).
 * Trust only when forwarded headers come from known edge (Vercel sets x-forwarded-proto).
 */
export function getTrustedPublicOriginFromRequest(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwardedHost || url.host || "").trim();
  const proto =
    forwardedProto === "https" || forwardedProto === "http"
      ? forwardedProto
      : url.protocol.replace(":", "");
  if (!host) return `${url.protocol}//${url.host}`;
  return `${proto}://${host}`;
}
