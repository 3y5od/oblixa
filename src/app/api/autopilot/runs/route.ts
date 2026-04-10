import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { listAutopilotRuns } from "@/lib/v6/autopilot";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6Autopilot");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_autopilot_runs_list_total", 1).catch(
    () => undefined
  );

  const { data, error } = await listAutopilotRuns(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ runs: data ?? [] });
}
