import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/simulations/[id]";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/simulations/[id]",
  });
  if (modeGate) return modeGate;

  const { id } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id }, ["id"], "/api/simulations/[id]");

  if (routeParamRejection) return routeParamRejection;
  const { data: simulation, error } = await ctx.admin
    .from("change_simulations")
    .select("id, simulation_type, name, input_json, latest_run_id, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "simulation_lookup_failed",
      diagnostic_id: "simulation_lookup_failed",
      route: ROUTE,
    });
  }
  if (!simulation) return jsonNotFound(ROUTE);

  const { data: runs } = await ctx.admin
    .from("change_simulation_runs")
    .select("id, status, result_json, promoted_campaign_id, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("simulation_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ simulation, runs: runs ?? [] });
}

