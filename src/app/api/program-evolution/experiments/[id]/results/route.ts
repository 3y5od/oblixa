import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { addProgramEvolutionResult } from "@/lib/v6/program-evolution";
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
    apiPath: "/api/program-evolution/experiments/[id]/results",
  });
  if (modeGate) return modeGate;

  const experimentId = toSafeString((await params).id);
  const body = readJsonBody<{
    periodStart?: string;
    periodEnd?: string;
    healthImpact?: Record<string, unknown>;
    scorecardDelta?: Record<string, unknown>;
    decisionSlippageDelta?: number;
    recommendation?: Record<string, unknown>;
  }>(await request.json().catch(() => ({})), {});

  const { data: scoreRows } = await ctx.admin
    .from("assurance_scorecards")
    .select("overall_score")
    .eq("organization_id", ctx.orgId)
    .limit(200);
  const scores = (scoreRows ?? [])
    .map((r) => Number((r as { overall_score?: number }).overall_score))
    .filter((n) => Number.isFinite(n));
  const avgOverall = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)) : null;

  const scorecardDelta = {
    ...(body.scorecardDelta ?? {}),
    portfolio_avg_overall_at_capture: avgOverall,
    scorecards_sampled: scores.length,
    captured_at: new Date().toISOString(),
  };

  const result = await addProgramEvolutionResult(ctx.admin, ctx.orgId, experimentId, {
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    healthImpact: body.healthImpact,
    scorecardDelta,
    decisionSlippageDelta: body.decisionSlippageDelta,
    recommendation: body.recommendation,
  });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_program_evolution_result_capture_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ result: result.data }, { status: 201 });
}
