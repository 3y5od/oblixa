import { NextResponse } from "next/server";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { createAutopilotRule, listAutopilotRules } from "@/lib/v6/autopilot";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { requireAssuranceWorkspaceForAutopilotApi } from "@/lib/v6/require-assurance-workspace-for-autopilot-api";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

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
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{ name?: string; actionType?: string; requiresApproval?: boolean }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const name = toSafeString(body.name);
  const actionType = toSafeString(body.actionType) || "request_evidence_refresh";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const validActionTypes = ["request_evidence_refresh", "flag_for_review", "auto_resolve", "notify_stakeholder", "escalate"];
  if (!validActionTypes.includes(actionType)) return NextResponse.json({ error: "Invalid actionType" }, { status: 400 });

  const result = await createAutopilotRule(ctx.admin, ctx.orgId, ctx.userId, {
    name,
    actionType,
    requiresApproval: body.requiresApproval,
  });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_autopilot_rule_create_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ rule: result.data }, { status: 201 });
}
