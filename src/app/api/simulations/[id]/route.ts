import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const { id } = await params;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/simulations/[id]",
  });
  if (modeGate) return modeGate;

  const { data: simulation, error } = await ctx.admin
    .from("change_simulations")
    .select("id, simulation_type, name, input_json, latest_run_id, created_at, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!simulation) return NextResponse.json({ error: "Simulation not found" }, { status: 404 });

  const { data: runs } = await ctx.admin
    .from("change_simulation_runs")
    .select("id, status, result_json, promoted_campaign_id, created_at")
    .eq("organization_id", ctx.orgId)
    .eq("simulation_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ simulation, runs: runs ?? [] });
}

