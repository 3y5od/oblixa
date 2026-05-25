import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { createControlPolicy, listControlPolicies } from "@/lib/assurance/control-policies";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

const ROUTE = "/api/control-policies";

export async function GET() {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_control_policies_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listControlPolicies(ctx.admin, ctx.orgId);
  if (error) {
    console.error("[api/control-policies] GET error:", error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "control_policies_list_failed",
      diagnostic_id: "control_policies_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ policies: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.control-policies",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/control-policies",
    method: "POST",
  }).catch(() => undefined);

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{ name?: string; objective?: string; enforcementMode?: string; scope?: Record<string, unknown> }>(
      raw ?? {},
      {}
    )
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const name = toSafeString(body.name);
  const objective = toSafeString(body.objective);
  if (!name || !objective) {
    return jsonProblem(400, {
      error: "name and objective are required",
      code: "name_objective_required",
      diagnostic_id: "control_policy_name_objective_required",
      route: ROUTE,
    });
  }

  const result = await createControlPolicy(ctx.admin, ctx.orgId, ctx.userId, {
    name,
    objective,
    enforcementMode: toSafeString(body.enforcementMode) || undefined,
    scope: body.scope,
  });

  if (result.error) {
    console.error("[api/control-policies] POST error:", result.error.message);
    return jsonProblem(400, {
      error: "Failed to process request",
      code: "control_policy_create_failed",
      diagnostic_id: "control_policy_create_failed",
      route: ROUTE,
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_control_policies_create_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ policy: result.data }, { status: 201 });
}
