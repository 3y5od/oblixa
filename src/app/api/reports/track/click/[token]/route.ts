import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";

function safeFallback(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/dashboard`;
}

function getSafeTarget(request: Request): string {
  const reqUrl = new URL(request.url);
  const targetRaw = reqUrl.searchParams.get("target") ?? "";
  if (!targetRaw) return safeFallback(request);
  try {
    // Only allow same-origin redirects. Relative paths are always resolved
    // against the current request origin and kept on-site.
    if (targetRaw.startsWith("/")) {
      if (targetRaw.startsWith("//")) return safeFallback(request);
      return new URL(targetRaw, reqUrl.origin).toString();
    }

    const target = new URL(targetRaw);
    if (!["http:", "https:"].includes(target.protocol)) {
      return safeFallback(request);
    }

    let allowedOrigin = reqUrl.origin;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (appUrl) {
      try {
        allowedOrigin = new URL(appUrl).origin;
      } catch {
        allowedOrigin = reqUrl.origin;
      }
    }
    if (target.origin !== allowedOrigin) return safeFallback(request);
    return target.toString();
  } catch {
    return safeFallback(request);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`report-track-click:${ip}`, RATE_LIMITS.reportTrackClick);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }
  const { token } = await params;
  const target = getSafeTarget(request);
  if (token && token.length >= 8) {
    const admin = await createAdminClient();
    const nowIso = new Date().toISOString();
    const { data: row } = await admin
      .from("report_run_recipients")
      .select("click_count")
      .eq("engagement_token", token)
      .maybeSingle();
    await admin
      .from("report_run_recipients")
      .update({
        clicked_at: nowIso,
        click_count: Math.max(0, Number(row?.click_count ?? 0)) + 1,
        last_clicked_url: target.slice(0, 2000),
        delivery_status: "clicked",
      })
      .eq("engagement_token", token);
  }
  const res = NextResponse.redirect(target, { status: 302 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
