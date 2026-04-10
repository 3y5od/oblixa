import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { buildAssuranceAnalyticsSummary } from "@/lib/v6/assurance-analytics";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_analytics_summary_total", 1).catch(
    () => undefined
  );

  const summary = await buildAssuranceAnalyticsSummary(ctx.admin, ctx.orgId);
  return NextResponse.json({ summary });
}
