import { NextResponse } from "next/server";

/**
 * GET after server-side signOut — emits Clear-Site-Data so shared terminals drop cached
 * session state faster, then redirects to login.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const login = new URL("/login", url.origin);
  const res = NextResponse.redirect(login);
  res.headers.set("Clear-Site-Data", '"cache", "cookies"');
  return res;
}
