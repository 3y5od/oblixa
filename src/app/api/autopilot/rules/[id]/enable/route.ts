import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { enableAutopilotRule } from "@/lib/v6/autopilot";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/v6/require-assurance-workspace-for-autopilot-api";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { enforceIdempotency } from "@/lib/idempotency";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/autopilot/rules/[id]/enable";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/rules/[id]/enable",
  });
  if (modeGate) return modeGate;

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId);
  if (modeBlock) return modeBlock;

  const ruleId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: ruleId }, ["id"], "/api/autopilot/rules/[id]/enable");

  if (routeParamRejection) return routeParamRejection;
  const duplicate = await enforceIdempotency(request, {
    scope: "autopilot.rules.enable",
    actorKey: `${ctx.orgId}:${ctx.userId}:${ruleId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/autopilot/rules/[id]/enable",
    method: "POST",
  }).catch(() => undefined);

  const result = await enableAutopilotRule(ctx.admin, ctx.orgId, ruleId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "autopilot_rule_enable_failed",
      diagnostic_id: "autopilot_rule_enable_failed",
      route: ROUTE,
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_autopilot_enable_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ rule: result.data });
}
