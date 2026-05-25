import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import {
  workflowExternalEvidenceRefresh,
  workflowFindingToIntervention,
  workflowPolicyBreachRemediation,
  workflowPortfolioBoardReview,
  workflowProgramPerformanceTuning,
} from "@/lib/assurance/workflows";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

export async function POST(request?: Request) {
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

  const duplicate = await enforceIdempotency(request, {
    scope: "api.assurance.workflows.run-all",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/assurance/workflows/run-all",
    method: "POST",
  }).catch(() => undefined);

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const [w1, w2, w3, w4, w5] = await Promise.all([
    workflowFindingToIntervention(ctx.admin, ctx.orgId, ctx.userId),
    workflowPolicyBreachRemediation(ctx.admin, ctx.orgId, ctx.userId),
    workflowExternalEvidenceRefresh(ctx.admin, ctx.orgId, ctx.userId),
    workflowProgramPerformanceTuning(ctx.admin, ctx.orgId, ctx.userId),
    workflowPortfolioBoardReview(ctx.admin, ctx.orgId, ctx.userId),
  ]);

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_assurance_workflows_run_all_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    documentation:
      "Runs five assurance reference workflows once (seed/demo). Not a substitute for scheduled assurance checks or user-driven playbook runs.",
    workflows: {
      findingToIntervention: w1,
      policyBreachRemediation: w2,
      externalEvidenceRefresh: w3,
      programPerformanceTuning: w4,
      portfolioBoardReview: w5,
    },
  });
}
