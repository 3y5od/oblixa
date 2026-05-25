import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { recomputeSegmentMemberships } from "@/lib/assurance/segments";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/segments/[id]/recompute";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Segments");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/segments/[id]/recompute",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.segments.id.recompute",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/segments/[id]/recompute",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const segmentId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: segmentId }, ["id"], "/api/segments/[id]/recompute");

  if (routeParamRejection) return routeParamRejection;
  const result = await recomputeSegmentMemberships(ctx.admin, ctx.orgId, segmentId);
  if ("error" in result && result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Segment recompute failed";
    return jsonProblem(400, {
      error: msg,
      code: "segment_recompute_failed",
      diagnostic_id: "segment_recompute_failed",
      route: ROUTE,
    });
  }
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_segment_recompute_total", 1).catch(() => undefined);
  return NextResponse.json({ ok: true, membershipCount: result.count });
}
