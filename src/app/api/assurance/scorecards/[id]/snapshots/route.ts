import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/decision-intelligence/api";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/assurance/scorecards/[id]/snapshots";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/scorecards/[id]/snapshots",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_scorecard_snapshots_list_total", 1).catch(
    () => undefined
  );

  const scorecardId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: scorecardId }, ["id"], "/api/assurance/scorecards/[id]/snapshots");

  if (routeParamRejection) return routeParamRejection;
  if (!scorecardId) {
    return jsonProblem(400, {
      error: "id is required",
      code: "id_required",
      diagnostic_id: "assurance_scorecard_id_required",
      route: ROUTE,
    });
  }

  const { data: sc } = await ctx.admin
    .from("assurance_scorecards")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", scorecardId)
    .maybeSingle();
  if (!sc) {
    return jsonNotFound(ROUTE);
  }

  const { data, error } = await ctx.admin
    .from("scorecard_snapshots")
    .select("id, snapshot_at, overall_score, dimensions_json, score_drivers_json")
    .eq("organization_id", ctx.orgId)
    .eq("assurance_scorecard_id", scorecardId)
    .order("snapshot_at", { ascending: false })
    .limit(80);

  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "scorecard_snapshots_list_failed",
      diagnostic_id: "scorecard_snapshots_list_failed",
      route: ROUTE,
    });
  }
  return NextResponse.json({ snapshots: data ?? [] });
}
