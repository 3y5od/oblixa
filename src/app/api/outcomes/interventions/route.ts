import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/v6/outcomes";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { parsePositiveIntParam } from "@/lib/security/validation";

const ROUTE = "/api/outcomes/interventions";

export async function GET(request: Request) {
  const disabled = requireV6ApiFeature("v6OutcomeIntelligence");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/outcomes/interventions",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_outcomes_interventions_total", 1).catch(
    () => undefined
  );

  const url = new URL(request.url);
  const limit = parsePositiveIntParam(url.searchParams.get("limit"), { defaultValue: 50, max: 200 });
  const offset = parsePositiveIntParam(url.searchParams.get("offset"), { defaultValue: 0, min: 0, max: 10_000 });

  const page = await listOutcomeInterventionsPaginated(ctx.admin, ctx.orgId, { limit, offset });
  if (page.error) {
    return jsonProblem(400, {
      error: page.error.message,
      code: "outcome_interventions_list_failed",
      diagnostic_id: "outcome_interventions_list_failed",
      route: ROUTE,
    });
  }

  const result = await computeOutcomeViews(ctx.admin, ctx.orgId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "outcome_views_compute_failed",
      diagnostic_id: "outcome_interventions_compute_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({
    interventionsPage: {
      rows: page.rows,
      total: page.total,
      limit,
      offset,
    },
    interventions: result.interventions,
    programEffectiveness: result.programEffectiveness,
    controlEffectiveness: result.controlEffectiveness,
    playbookEffectiveness: result.playbookEffectiveness,
    weeklyEffectiveness: result.weeklyEffectiveness ?? [],
    summary: result.summary,
  });
}
