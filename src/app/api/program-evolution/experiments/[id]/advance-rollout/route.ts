import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { addProgramEvolutionResult, advanceExperimentRollout } from "@/lib/v6/program-evolution";
import { gatherPortfolioMetrics } from "@/lib/v6/portfolio-metrics";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

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

  const id = toSafeString((await params).id);
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
  if (expErr) return NextResponse.json({ error: expErr.message }, { status: 400 });
  if (!expRow) return NextResponse.json({ error: "Experiment not found" }, { status: 404 });

  const updated = await advanceExperimentRollout(ctx.admin, ctx.orgId, id, stage);
  if (updated.error) {
    return NextResponse.json({ error: (updated.error as { message?: string }).message }, { status: 400 });
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
    return NextResponse.json(
      { error: (resRow.error as { message?: string }).message ?? "result insert failed", experiment: updated.data },
      { status: 400 }
    );
  }

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_program_evolution_advance_rollout_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ experiment: updated.data, result: resRow.data });
}
