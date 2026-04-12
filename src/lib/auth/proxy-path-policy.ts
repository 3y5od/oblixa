import {
  isMetadataImageRoute,
  isPublicInformationPath,
} from "@/lib/marketing/public-paths";

const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];

/**
 * Login/signup surfaces: authenticated users are redirected to the app from these paths.
 */
export function isPublicAuthSurfacePath(pathname: string): boolean {
  return publicRoutes.some((route) => pathname === route);
}

/**
 * When the user has no session, proxy allows these paths without redirecting to /login.
 * /api/* is included so each route handler remains responsible for auth (see AGENTS.md).
 */
export function unauthenticatedAccessAllowed(pathname: string): boolean {
  const isPublicRoute = isPublicAuthSurfacePath(pathname);
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isApiRoute = pathname.startsWith("/api/");
  const isExternalParticipantPage =
    pathname.startsWith("/external/") && pathname !== "/external";
  const isPublicInformation = isPublicInformationPath(pathname);
  const isOgOrMetaImage = isMetadataImageRoute(pathname);
  const isCrawlerAsset =
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/.well-known/");
  return (
    isPublicRoute ||
    isAuthCallback ||
    isApiRoute ||
    pathname === "/" ||
    isExternalParticipantPage ||
    isPublicInformation ||
    isOgOrMetaImage ||
    isCrawlerAsset
  );
}
