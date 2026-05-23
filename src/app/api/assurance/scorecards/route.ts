import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { listScorecards } from "@/lib/v6/assurance";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

const ROUTE = "/api/assurance/scorecards";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/scorecards",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_scorecards_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listScorecards(ctx.admin, ctx.orgId);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "assurance_scorecards_list_failed",
      diagnostic_id: "assurance_scorecards_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({
    scorecards: data ?? [],
    explainability_note:
      "Each row includes score_drivers_json and dimensions_json; compare scorecard_snapshots for drift drivers.",
  });
}
