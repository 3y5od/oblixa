/**
 * Public marketing / legal paths: single source for middleware allowlist, sitemap, and tests.
 * Keep in sync with `src/lib/auth/proxy-path-policy.ts` (used by `src/proxy.ts`).
 */

/** Readable without a session. Compatibility paths may be readable without becoming sitemap entries. */
export const PUBLIC_INFORMATION_PATHS = [
  "/product",
  "/request-access",
  "/early-access",
  "/pricing",
  "/contact",
  "/privacy",
  "/terms",
  "/security",
  "/acceptable-use",
  "/accessibility",
  "/cookies",
] as const;

/** Indexable marketing and legal URLs only. Auth and compatibility routes are intentionally excluded. */
export const SITEMAP_PATHS = [
  "/",
  "/product",
  "/request-access",
  "/pricing",
  "/contact",
  "/security",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/accessibility",
  "/cookies",
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
