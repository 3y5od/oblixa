import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { getClientIpFromHeaders, rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit";
import { getAuthContext } from "@/lib/supabase/server";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const CORE_PATH_RE = /^\/[A-Za-z0-9/_\-?#.&=[\]%+]*$/;

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response(null, { status: 204 });

  const ip = await getClientIpFromHeaders();
  const hit = await rateLimitCheck(
    `v9-product-telemetry:${ctx.user.id}:${ip}`,
    RATE_LIMITS.productV9Telemetry
  );
  if (!hit.ok) return new Response(null, { status: 204 });

  const duplicate = await enforceIdempotency(request, {
    scope: "api.product-telemetry.page-load",
    actorKey: `${ctx.orgId}:${ctx.user.id}`,
  });
  if (duplicate) return duplicate;

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? null) as {
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

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.user.id,
    route: "/api/product-telemetry/page-load",
    method: "POST",
  }).catch(() => undefined);

  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.user.id,
    action: "product.v9.page_load_measured",
    details: { path, durationMs: Math.round(durationMs) },
  });
  return new Response(null, { status: 204 });
}
