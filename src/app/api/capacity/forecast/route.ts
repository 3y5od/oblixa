import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

/**
 * Each row’s `forecast_json` is written by the capacity-forecast-refresh cron. See
 * `CAPACITY_FORECAST_JSON_KEYS` in `@/lib/v5/capacity-forecast-keys` for stable field names
 * (includes `open_tasks_by_team_key` and `pending_approvals_by_type`).
 */

export async function GET() {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/capacity/forecast",
  });
  if (modeGate) return modeGate;

  const { data, error } = await ctx.admin
    .from("capacity_forecasts")
    .select("id, forecast_horizon_days, forecast_json, model_version, generated_at, expires_at")
    .eq("organization_id", ctx.orgId)
    .order("generated_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ forecasts: data ?? [] });
}

