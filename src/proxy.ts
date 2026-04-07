import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env/server";

const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password"];

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

  const isPublicRoute = publicRoutes.some((route) => pathname === route);
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isApiRoute = pathname.startsWith("/api/");

  if (!user && !isPublicRoute && !isAuthCallback && !isApiRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
