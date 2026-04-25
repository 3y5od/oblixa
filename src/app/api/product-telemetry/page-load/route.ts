import { NextResponse } from "next/server";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { getClientIpFromHeaders, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { getAuthContext } from "@/lib/supabase/server";

const CORE_PATH_RE = /^\/[A-Za-z0-9/_\-?#.&=[\]%+]*$/;

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response(null, { status: 204 });

  const body = (await request.json().catch(() => null)) as {
    path?: unknown;
    durationMs?: unknown;
  } | null;
  const path = typeof body?.path === "string" ? body.path.trim() : "";
  const durationMs = Number(body?.durationMs);
  if (!path || path.length > 220 || !CORE_PATH_RE.test(path)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600_000) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ip = await getClientIpFromHeaders();
  const hit = await rateLimitCheck(
    `v9-product-telemetry:${ctx.user.id}:${ip}`,
    RATE_LIMITS.productV9Telemetry
  );
  if (!hit.ok) return new Response(null, { status: 204 });

  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.page_load_measured",
    details: { path, durationMs: Math.round(durationMs) },
  });
  return new Response(null, { status: 204 });
}
