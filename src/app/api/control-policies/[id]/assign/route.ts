import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { assignControlPolicy } from "@/lib/v6/control-policies";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/control-policies/[id]/assign";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies/[id]/assign",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.control-policies.id.assign",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/control-policies/[id]/assign",
    method: "POST",
  }).catch(() => undefined);

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{ assignmentType?: string; segmentId?: string; targetRefType?: string; targetRefId?: string }>(
      raw ?? {},
      {}
    )
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const policyId = toSafeString((await params).id);
  const routeParamRejection = rejectUnsafeRouteParams({ id: policyId }, ["id"], "/api/control-policies/[id]/assign");
  if (routeParamRejection) return routeParamRejection;
  const assignmentType = toSafeString(body.assignmentType) || "global";

  const result = await assignControlPolicy(ctx.admin, ctx.orgId, policyId, ctx.userId, {
    assignmentType,
    segmentId: toSafeString(body.segmentId) || undefined,
    targetRefType: toSafeString(body.targetRefType) || undefined,
    targetRefId: toSafeString(body.targetRefId) || undefined,
  });

  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "control_policy_assignment_failed",
      diagnostic_id: "control_policy_assignment_failed",
      route: ROUTE,
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_control_policy_assign_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ assignment: result.data }, { status: 201 });
}
