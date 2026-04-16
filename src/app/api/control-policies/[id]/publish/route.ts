import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { publishControlPolicy } from "@/lib/v6/control-policies";
import { gatherPortfolioMetrics } from "@/lib/v6/portfolio-metrics";
import { recordControlPolicyOutcome } from "@/lib/v6/outcome-writers";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { enforceIdempotency } from "@/lib/idempotency";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies/[id]/publish",
  });
  if (modeGate) return modeGate;
  const duplicate = await enforceIdempotency(request, {
    scope: "control-policies.publish",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const policyId = toSafeString((await params).id);
  const metricsBefore = await gatherPortfolioMetrics(ctx.admin, ctx.orgId);
  const body = readJsonBody<{
    policyJson?: Record<string, unknown>;
    evidenceExpectationsJson?: unknown;
    slaThresholdsJson?: unknown;
    exemptionRulesJson?: unknown;
    severityModelJson?: unknown;
  }>(await request.json().catch(() => ({})), {});
  const result = await publishControlPolicy(ctx.admin, ctx.orgId, policyId, ctx.userId, {
    policyJson: body.policyJson,
    evidenceExpectationsJson: body.evidenceExpectationsJson,
    slaThresholdsJson: body.slaThresholdsJson,
    exemptionRulesJson: body.exemptionRulesJson,
    severityModelJson: body.severityModelJson,
  });
  if (result.error) {
    const err = result.error as { message?: string; issues?: unknown };
    return NextResponse.json(
      { error: err.message ?? "Publish failed", issues: err.issues },
      { status: 400 }
    );
  }
  await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_control_policy_publish_total", 1).catch(() => undefined);
  if (isFeatureEnabled("v6OutcomeIntelligence")) {
    const metricsAfter = await gatherPortfolioMetrics(ctx.admin, ctx.orgId);
    await recordControlPolicyOutcome(ctx.admin, ctx.orgId, policyId, metricsBefore, metricsAfter).catch(() => undefined);
  }
  return NextResponse.json({ policy: result.policy, version: result.version });
}
