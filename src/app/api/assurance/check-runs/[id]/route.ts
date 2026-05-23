import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem } from "@/lib/http/problem";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/assurance/check-runs/[id]";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/check-runs/[id]",
  });
  if (modeGate) return modeGate;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_check_run_detail_total", 1).catch(
    () => undefined
  );

  const runId = toSafeString((await params).id);

  const routeParamRejection = rejectUnsafeRouteParams({ id: runId }, ["id"], "/api/assurance/check-runs/[id]");

  if (routeParamRejection) return routeParamRejection;
  if (!runId) {
    return jsonProblem(400, {
      error: "id is required",
      code: "id_required",
      diagnostic_id: "assurance_check_run_id_required",
      route: ROUTE,
    });
  }

  const { data, error } = await ctx.admin
    .from("assurance_check_runs")
    .select(
      "id, organization_id, check_type, trigger_type, status, summary_json, risk_delta_json, watch_signals_json, recommended_interventions_json, started_at, completed_at, created_by, created_at"
    )
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "assurance_check_run_lookup_failed",
      diagnostic_id: "assurance_check_run_lookup_failed",
      route: ROUTE,
    });
  }
  if (!data) return jsonNotFound(ROUTE);

  return NextResponse.json({ checkRun: data });
}
