import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { disableAutopilotRule, patchAutopilotRule } from "@/lib/v6/autopilot";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const ruleId = toSafeString((await params).id);
  const body = readJsonBody<{
    allowlist?: string[];
    enabled?: boolean;
    guardrails?: Record<string, unknown>;
  }>(await request.json().catch(() => ({})), {});

  const result = await patchAutopilotRule(ctx.admin, ctx.orgId, ruleId, {
    allowlist: Array.isArray(body.allowlist) ? body.allowlist.map((s) => String(s)) : undefined,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    guardrails: body.guardrails && typeof body.guardrails === "object" ? body.guardrails : undefined,
  });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_autopilot_rule_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ rule: result.data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const ruleId = toSafeString((await params).id);
  const result = await disableAutopilotRule(ctx.admin, ctx.orgId, ruleId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_delete_autopilot_rule_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ rule: result.data });
}
