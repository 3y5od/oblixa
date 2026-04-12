import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import {
  workflowExternalEvidenceRefresh,
  workflowFindingToIntervention,
  workflowPolicyBreachRemediation,
  workflowPortfolioBoardReview,
  workflowProgramPerformanceTuning,
} from "@/lib/v6/workflows";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/workflows/run-all",
  });
  if (modeGate) return modeGate;

  const [w1, w2, w3, w4, w5] = await Promise.all([
    workflowFindingToIntervention(ctx.admin, ctx.orgId, ctx.userId),
    workflowPolicyBreachRemediation(ctx.admin, ctx.orgId, ctx.userId),
    workflowExternalEvidenceRefresh(ctx.admin, ctx.orgId, ctx.userId),
    workflowProgramPerformanceTuning(ctx.admin, ctx.orgId, ctx.userId),
    workflowPortfolioBoardReview(ctx.admin, ctx.orgId, ctx.userId),
  ]);

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_assurance_workflows_run_all_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    documentation:
      "Runs five V6 strategy-doc reference workflows once (seed/demo). Not a substitute for scheduled assurance checks or user-driven playbook runs.",
    workflows: {
      findingToIntervention: w1,
      policyBreachRemediation: w2,
      externalEvidenceRefresh: w3,
      programPerformanceTuning: w4,
      portfolioBoardReview: w5,
    },
  });
}
