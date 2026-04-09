import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function safeFallback(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/dashboard`;
}

function getSafeTarget(request: Request): string {
  const reqUrl = new URL(request.url);
  const targetRaw = reqUrl.searchParams.get("target") ?? "";
  if (!targetRaw) return safeFallback(request);
  try {
    const target = new URL(targetRaw);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (appUrl) {
      const appOrigin = new URL(appUrl).origin;
      if (target.origin !== appOrigin) return safeFallback(request);
    }
    return target.toString();
  } catch {
    return safeFallback(request);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
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
  return NextResponse.redirect(target, { status: 302 });
}
