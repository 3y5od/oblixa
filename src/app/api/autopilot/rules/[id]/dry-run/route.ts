import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { dryRunAutopilotRule } from "@/lib/v6/autopilot";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/v6/require-assurance-workspace-for-autopilot-api";
import { enforceIdempotency } from "@/lib/idempotency";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/autopilot/rules/[id]/dry-run";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/rules/[id]/dry-run",
  });
  if (modeGate) return modeGate;

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId, "dry_run");
  if (modeBlock) return modeBlock;
  const duplicate = await enforceIdempotency(request, {
    scope: "autopilot.dry-run",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/autopilot/rules/[id]/dry-run",
    method: "POST",
  }).catch(() => undefined);

  const ruleId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: ruleId }, ["id"], "/api/autopilot/rules/[id]/dry-run");

  if (routeParamRejection) return routeParamRejection;
  const result = await dryRunAutopilotRule(ctx.admin, ctx.orgId, ruleId, ctx.userId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "autopilot_rule_dry_run_failed",
      diagnostic_id: "autopilot_rule_dry_run_failed",
      route: ROUTE,
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_autopilot_dry_run_total", 1).catch(() => undefined);
  return NextResponse.json({ rule: result.rule, run: result.run });
}
