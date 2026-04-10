import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_scorecard_snapshots_list_total", 1).catch(
    () => undefined
  );

  const scorecardId = toSafeString((await params).id);
  if (!scorecardId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: sc } = await ctx.admin
    .from("assurance_scorecards")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("id", scorecardId)
    .maybeSingle();
  if (!sc) {
    return NextResponse.json({ error: "scorecard_not_found" }, { status: 404 });
  }

  const { data, error } = await ctx.admin
    .from("scorecard_snapshots")
    .select("id, snapshot_at, overall_score, dimensions_json, score_drivers_json")
    .eq("organization_id", ctx.orgId)
    .eq("assurance_scorecard_id", scorecardId)
    .order("snapshot_at", { ascending: false })
    .limit(80);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ snapshots: data ?? [] });
}
