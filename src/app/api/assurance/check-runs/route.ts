import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET(request: Request) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_check_runs_list_total", 1).catch(
    () => undefined
  );

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitRaw) ? Math.min(80, Math.max(1, Math.floor(limitRaw))) : 30;

  const { data, error } = await ctx.admin
    .from("assurance_check_runs")
    .select(
      "id, check_type, trigger_type, status, created_at, completed_at, watch_signals_json, recommended_interventions_json, risk_delta_json, summary_json"
    )
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ checkRuns: data ?? [] });
}
