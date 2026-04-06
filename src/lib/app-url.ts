/**
 * Base URL for absolute links, server-side fetches, and redirects.
 * Trailing slashes are stripped so `${getAppBaseUrl()}/path` never produces `//`.
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
