import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { simulateControlPolicy } from "@/lib/assurance/control-policies";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/control-policies/[id]/simulate";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies/[id]/simulate",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.control-policies.id.simulate",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/control-policies/[id]/simulate",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const policyId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: policyId }, ["id"], "/api/control-policies/[id]/simulate");

  if (routeParamRejection) return routeParamRejection;
  const result = await simulateControlPolicy(ctx.admin, ctx.orgId, policyId, ctx.userId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "control_policy_simulation_failed",
      diagnostic_id: "control_policy_simulation_failed",
      route: ROUTE,
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_control_policy_simulate_total", 1).catch(
    () => undefined
  );
  return NextResponse.json(
    { simulation: result.data, evaluations: result.evaluations ?? [] },
    { status: 201 }
  );
}
