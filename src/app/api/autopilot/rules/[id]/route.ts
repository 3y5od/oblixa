import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { parseJsonBodyWithLimit, rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { disableAutopilotRule, patchAutopilotRule } from "@/lib/assurance/autopilot";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/assurance/require-assurance-workspace-for-autopilot-api";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { enforceIdempotency } from "@/lib/idempotency";
import { requireExpectedVersionForMutation, staleExpectedVersionResponse } from "@/lib/security/stale-write-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/autopilot/rules/[id]";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/rules/[id]",
  });
  if (modeGate) return modeGate;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId);
  if (modeBlock) return modeBlock;

  const ruleId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: ruleId }, ["id"], "/api/autopilot/rules/[id]");

  if (routeParamRejection) return routeParamRejection;
  const duplicate = await enforceIdempotency(request, {
    scope: "autopilot.rules.patch",
    actorKey: `${ctx.orgId}:${ctx.userId}:${ruleId}`,
  });
  if (duplicate) return duplicate;

  const expectedVersionResult = requireExpectedVersionForMutation(request, {
    route: ROUTE,
    diagnosticPrefix: "autopilot_rule",
  });
  if (!expectedVersionResult.ok) return expectedVersionResult.response;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/autopilot/rules/[id]",
    method: "PATCH",
  }).catch(() => undefined);

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{
      allowlist?: string[];
      enabled?: boolean;
      guardrails?: Record<string, unknown>;
    }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const result = await patchAutopilotRule(
    ctx.admin,
    ctx.orgId,
    ruleId,
    {
      allowlist: Array.isArray(body.allowlist) ? body.allowlist.map((s) => String(s)) : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      guardrails: body.guardrails && typeof body.guardrails === "object" ? body.guardrails : undefined,
    },
    expectedVersionResult.expectedVersion
  );
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "autopilot_rule_update_failed",
      diagnostic_id: "autopilot_rule_update_failed",
      route: ROUTE,
    });
  }
  if (!result.data) {
    return staleExpectedVersionResponse({
      route: ROUTE,
      diagnosticPrefix: "autopilot_rule",
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_patch_autopilot_rule_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ rule: result.data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/autopilot/rules/[id]",
  });
  if (modeGate) return modeGate;

  const modeBlock = await requireAssuranceWorkspaceForAutopilotApi(ctx.admin, ctx.orgId);
  if (modeBlock) return modeBlock;

  const ruleId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: ruleId }, ["id"], "/api/autopilot/rules/[id]");

  if (routeParamRejection) return routeParamRejection;
  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const duplicate = await enforceIdempotency(request, {
    scope: "autopilot.rules.disable",
    actorKey: `${ctx.orgId}:${ctx.userId}:${ruleId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/autopilot/rules/[id]",
    method: "DELETE",
  }).catch(() => undefined);

  const result = await disableAutopilotRule(ctx.admin, ctx.orgId, ruleId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "autopilot_rule_disable_failed",
      diagnostic_id: "autopilot_rule_disable_failed",
      route: ROUTE,
    });
  }
  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_delete_autopilot_rule_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ rule: result.data });
}
