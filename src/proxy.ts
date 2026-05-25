import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env/server";
import {
  isPublicAuthSurfacePath,
  unauthenticatedAccessAllowed,
} from "@/lib/auth/proxy-path-policy";
import { resolveBlockingCalibrationPathForUserClient } from "@/lib/onboarding/calibration-gate";
import { applyCorrelationHeadersToResponse, resolveCorrelationIds } from "@/lib/observability/request-id";
import { OBLIXA_PATHNAME_HEADER } from "@/lib/product-surface/request-pathname";
import { getSafeRedirectPath } from "@/lib/security/redirect";
import { hasMethodOverrideAttempt, secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";
import {
  createSupabaseTimeoutFetch,
  SUPABASE_PROXY_FETCH_TIMEOUT_MS,
} from "@/lib/supabase/fetch";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAFE_METHODS = new Set(["GET", "HEAD"]);
export const proxySupabaseFetch = createSupabaseTimeoutFetch(
  SUPABASE_PROXY_FETCH_TIMEOUT_MS
); // security:fetch-allowlist SEC-proxy-supabase-auth-timeout trusted Supabase env URL; timeout-bounded

function isBrowserOriginPolicyExemptApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/external-actions/") ||
    pathname === "/api/stripe/webhook" ||
    pathname === "/api/integrations/actions/callback"
  );
}

function requiresBrowserOriginPolicy(request: NextRequest, pathname: string): boolean {
  return pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method) && !isBrowserOriginPolicyExemptApiPath(pathname);
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => /^sb-.+-auth-token(?:\.|$)/.test(cookie.name));
}

function skipsProxyAuthProvider(request: NextRequest, pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true;
  if (isPublicAuthSurfacePath(pathname)) return true;
  return SAFE_METHODS.has(request.method) && unauthenticatedAccessAllowed(pathname);
}

/**
 * Edge proxy notes (see debugging sweep catalog):
 * - `request.ip` / `geo` are sensitive; never log raw values here.
 * - Correlation headers are attached to responses only (see `resolveCorrelationIds`).
 */
function withOblixaPathname(res: NextResponse, pathname: string): NextResponse {
  res.headers.set(OBLIXA_PATHNAME_HEADER, pathname);
  return res;
}

function passThroughResponse(
  request: NextRequest,
  pathname: string,
  correlationIds: ReturnType<typeof resolveCorrelationIds>
) {
  return applyCorrelationHeadersToResponse(
    withOblixaPathname(NextResponse.next({ request }), pathname),
    correlationIds
  );
}

function buildLoginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const next = getSafeRedirectPath(request.nextUrl.pathname);
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

// Marketing surfaces are GET-only for anonymous users; auth mutations stay on server actions with existing limits.
// Keep branches cheap: avoid extra DB or network work here beyond Supabase session refresh for protected paths.
// Cookie refresh: mutate the existing NextResponse + request cookies instead of allocating a fresh NextResponse.next
// on every setAll (Supabase SSR may batch several cookie writes per getUser/session refresh).

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();
  const correlationIds = resolveCorrelationIds(request);

  const supabaseResponse = passThroughResponse(request, pathname, correlationIds);

  if (pathname.startsWith("/api/") && hasMethodOverrideAttempt(request)) {
    return applyCorrelationHeadersToResponse(
      NextResponse.json(
        {
          error: "Method override is not allowed",
          code: "method_override_rejected",
          diagnostic_id: "proxy_method_override_rejected",
          route: pathname,
        },
        { status: 400 }
      ),
      correlationIds
    );
  }

  if (requiresBrowserOriginPolicy(request, pathname) && !secFetchSiteAllowsSensitiveMutation(request)) {
    return applyCorrelationHeadersToResponse(
      NextResponse.json(
        {
          error: "Cross-site request rejected",
          code: "cross_site_request_rejected",
          diagnostic_id: "proxy_cross_site_rejected",
          route: pathname,
        },
        { status: 403 }
      ),
      correlationIds
    );
  }

  if (skipsProxyAuthProvider(request, pathname)) {
    return supabaseResponse;
  }

  if (!hasSupabaseAuthCookie(request) && !unauthenticatedAccessAllowed(pathname)) {
    return applyCorrelationHeadersToResponse(buildLoginRedirect(request), correlationIds);
  }

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
      global: {
        fetch: proxySupabaseFetch,
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !unauthenticatedAccessAllowed(pathname)) {
    return applyCorrelationHeadersToResponse(buildLoginRedirect(request), correlationIds);
  }

  if (user && request.method === "GET") {
    const calPath = await resolveBlockingCalibrationPathForUserClient(supabase);
    if (
      calPath &&
      pathname !== calPath &&
      !pathname.startsWith("/onboarding/") &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/auth/") &&
      !pathname.startsWith("/external/") &&
      !pathname.startsWith("/.well-known/")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = calPath;
      url.search = "";
      return applyCorrelationHeadersToResponse(NextResponse.redirect(url), correlationIds);
    }
  }

  if (user && isPublicAuthSurfacePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return applyCorrelationHeadersToResponse(NextResponse.redirect(url), correlationIds);
  }

  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    // Default app entry; org-specific landing is applied after OAuth in auth/callback (default_landing_path).
    url.pathname = "/dashboard";
    return applyCorrelationHeadersToResponse(NextResponse.redirect(url), correlationIds);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip auth handshake for static assets and common root files (fonts, manifests, maps).
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|woff2?|ttf|eot|json|txt|xml|map|webmanifest)$).*)",
  ],
};
