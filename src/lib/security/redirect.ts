/**
 * Prevent open redirects after auth: only same-origin relative paths, no scheme or "//".
 */
export function getSafeRedirectPath(raw: string | null, maxLen = 512): string {
  const fallback = "/dashboard";
  if (raw == null) return fallback;
  const s = raw.trim();
  if (s.length === 0 || s.length > maxLen) return fallback;
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("://")) {
    return fallback;
  }
  if (/[\x00-\x1f\x7f\\]/.test(s) || s.includes("@") || s.includes("<")) {
    return fallback;
  }
  return s;
}
