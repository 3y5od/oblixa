import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { computeOutcomeViews } from "@/lib/v6/outcomes";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

const ROUTE = "/api/outcomes/control-effectiveness";

export async function GET() {
  const disabled = requireV6ApiFeature("v6OutcomeIntelligence");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/outcomes/control-effectiveness",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_outcomes_control_effectiveness_total", 1).catch(
    () => undefined
  );

  const result = await computeOutcomeViews(ctx.admin, ctx.orgId);
  if (result.error) {
    return jsonProblem(400, {
      error: result.error.message,
      code: "outcome_views_compute_failed",
      diagnostic_id: "control_effectiveness_compute_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ controlEffectiveness: result.controlEffectiveness });
}
