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

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_check_run_detail_total", 1).catch(
    () => undefined
  );

  const runId = toSafeString((await params).id);
  if (!runId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data, error } = await ctx.admin
    .from("assurance_check_runs")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .eq("id", runId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "check_run_not_found" }, { status: 404 });

  return NextResponse.json({ checkRun: data });
}
