import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env/server";
import {
  isPublicAuthSurfacePath,
  unauthenticatedAccessAllowed,
} from "@/lib/auth/proxy-path-policy";
import { resolveBlockingCalibrationPathForUserClient } from "@/lib/onboarding/calibration-gate";

// Marketing surfaces are GET-only for anonymous users; auth mutations stay on server actions with existing limits.
// Keep branches cheap: avoid extra DB or network work here beyond Supabase session refresh for protected paths.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
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
    return NextResponse.redirect(url);
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
      return NextResponse.redirect(url);
    }
  }

  if (user && isPublicAuthSurfacePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    // Default app entry; org-specific landing is applied after OAuth in auth/callback (default_landing_path).
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip auth handshake for static assets and common root files (fonts, manifests, maps).
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|woff2?|ttf|eot|json|txt|xml|map|webmanifest)$).*)",
  ],
};
