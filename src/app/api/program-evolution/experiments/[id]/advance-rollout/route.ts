import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/decision-intelligence/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import { addProgramEvolutionResult, advanceExperimentRollout } from "@/lib/assurance/program-evolution";
import { gatherPortfolioMetrics } from "@/lib/assurance/portfolio-metrics";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/program-evolution/experiments/[id]/advance-rollout";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/program-evolution/experiments/[id]/advance-rollout",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "api.program-evolution.experiments.id.advance-rollout",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/program-evolution/experiments/[id]/advance-rollout",
    method: "POST",
  }).catch(() => undefined);

  const id = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/program-evolution/experiments/[id]/advance-rollout");

  if (routeParamRejection) return routeParamRejection;
  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = readJsonBody<{ stage?: string }>(_lb_body.body ?? {}, {});
  const stage = toSafeString(body.stage).trim() || "segment_expansion";

  const { data: expRow, error: expErr } = await ctx.admin
    .from("program_evolution_experiments")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (expErr) {
    return jsonProblem(400, {
      error: expErr.message,
      code: "program_evolution_experiment_lookup_failed",
      diagnostic_id: "program_evolution_experiment_lookup_failed",
      route: ROUTE,
    });
  }
  if (!expRow) return jsonNotFound(ROUTE);

  const updated = await advanceExperimentRollout(ctx.admin, ctx.orgId, id, stage);
  if (updated.error) {
    return jsonProblem(400, {
      error: (updated.error as { message?: string }).message ?? "rollout advance failed",
      code: "program_evolution_rollout_advance_failed",
      diagnostic_id: "program_evolution_rollout_advance_failed",
      route: ROUTE,
    });
  }

  const metrics = await gatherPortfolioMetrics(ctx.admin, ctx.orgId);
  const resRow = await addProgramEvolutionResult(ctx.admin, ctx.orgId, id, {
    healthImpact: {
      milestone: "rollout_stage_advanced",
      stage,
      portfolio_metrics_snapshot: metrics,
      recorded_at: new Date().toISOString(),
    },
    recommendation: { next: "Monitor segment scorecards and findings before wider rollout." },
  });
  if (resRow.error) {
    return jsonProblem(400, {
      error: (resRow.error as { message?: string }).message ?? "result insert failed",
      code: "program_evolution_result_insert_failed",
      diagnostic_id: "program_evolution_result_insert_failed",
      route: ROUTE,
      details: { experiment: updated.data },
    });
  }

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_post_program_evolution_advance_rollout_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ experiment: updated.data, result: resRow.data });
}
