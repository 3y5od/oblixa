import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env/server";
import {
  isPublicAuthSurfacePath,
  unauthenticatedAccessAllowed,
} from "@/lib/auth/proxy-path-policy";
import { resolveBlockingCalibrationPathForUserClient } from "@/lib/onboarding/calibration-gate";
import { applyCorrelationHeadersToResponse, resolveCorrelationIds } from "@/lib/observability/request-id";
import { OBLIXA_PATHNAME_HEADER } from "@/lib/product-surface/v8-request-pathname";

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

// Marketing surfaces are GET-only for anonymous users; auth mutations stay on server actions with existing limits.
// Keep branches cheap: avoid extra DB or network work here beyond Supabase session refresh for protected paths.
// Cookie refresh: mutate the existing NextResponse + request cookies instead of allocating a fresh NextResponse.next
// on every setAll (Supabase SSR may batch several cookie writes per getUser/session refresh).

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();
  const correlationIds = resolveCorrelationIds(request);

  const supabaseResponse = passThroughResponse(request, pathname, correlationIds);

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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !unauthenticatedAccessAllowed(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applyCorrelationHeadersToResponse(NextResponse.redirect(url), correlationIds);
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
