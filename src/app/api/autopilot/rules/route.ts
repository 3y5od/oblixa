import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { BODY_LIMIT_MEDIUM_JSON, parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { createAutopilotRule, listAutopilotRules } from "@/lib/v6/autopilot";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/v6/require-assurance-workspace-for-autopilot-api";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { enforceIdempotency } from "@/lib/idempotency";

const ROUTE = "/api/autopilot/rules";

export async function GET() {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/rules",
  });
  if (modeGate) return modeGate;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId);
  if (modeBlock) return modeBlock;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_autopilot_rules_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listAutopilotRules(ctx.admin, ctx.orgId);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "autopilot_rules_list_failed",
      diagnostic_id: "autopilot_rules_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/rules",
  });
  if (modeGate) return modeGate;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId);
  if (modeBlock) return modeBlock;

  const duplicate = await enforceIdempotency(request, {
    scope: "autopilot.rules.create",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/autopilot/rules",
    method: "POST",
  }).catch(() => undefined);

  const parsedBody = await parseJsonBodyWithLimit(
    request,
    (raw) => readJsonBody<{ name?: string; actionType?: string; requiresApproval?: boolean }>(raw ?? {}, {}),
    BODY_LIMIT_MEDIUM_JSON
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const name = toSafeString(body.name);
  const actionType = toSafeString(body.actionType) || "request_evidence_refresh";
  if (!name) {
    return jsonProblem(400, {
      error: "name is required",
      code: "name_required",
      diagnostic_id: "autopilot_rule_name_required",
      route: ROUTE,
    });
  }
  const validActionTypes = ["request_evidence_refresh", "flag_for_review", "auto_resolve", "notify_stakeholder", "escalate"];
  if (!validActionTypes.includes(actionType)) {
    return jsonProblem(400, {
      error: "Invalid actionType",
      code: "invalid_action_type",
      diagnostic_id: "autopilot_rule_action_type_invalid",
      route: ROUTE,
    });
  }

  const result = await createAutopilotRule(ctx.admin, ctx.orgId, ctx.userId, {
    name,
    actionType,
    requiresApproval: body.requiresApproval,
  });
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "autopilot_rule_create_failed",
      diagnostic_id: "autopilot_rule_create_failed",
      route: ROUTE,
    });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_autopilot_rule_create_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ rule: result.data }, { status: 201 });
}
