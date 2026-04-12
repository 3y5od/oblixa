/**
 * Public marketing / legal paths: single source for middleware allowlist, sitemap, and tests.
 * Keep in sync with `src/lib/auth/proxy-path-policy.ts` (used by `src/proxy.ts`).
 */

/** Readable without a session (not in `publicRoutes` — those redirect authed users to dashboard). */
export const PUBLIC_INFORMATION_PATHS = [
  "/privacy",
  "/terms",
  "/security",
  "/accessibility",
  "/cookies",
] as const;

/** Indexable-ish marketing URLs for sitemap (includes auth entry points). */
export const SITEMAP_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  ...PUBLIC_INFORMATION_PATHS,
] as const;

export type PublicInformationPath = (typeof PUBLIC_INFORMATION_PATHS)[number];
export type SitemapPath = (typeof SITEMAP_PATHS)[number];

export function isPublicInformationPath(pathname: string): boolean {
  return (PUBLIC_INFORMATION_PATHS as readonly string[]).includes(pathname);
}

/** Next.js metadata image routes and similar (crawlers have no session cookies). */
export function isMetadataImageRoute(pathname: string): boolean {
  if (pathname === "/opengraph-image" || pathname === "/twitter-image") return true;
  if (pathname.startsWith("/opengraph-image/") || pathname.startsWith("/twitter-image/"))
    return true;
  if (pathname === "/icon" || pathname.startsWith("/icon/")) return true;
  if (pathname === "/apple-icon" || pathname.startsWith("/apple-icon/")) return true;
  return false;
}
