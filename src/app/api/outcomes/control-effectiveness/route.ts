import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { computeOutcomeViews } from "@/lib/v6/outcomes";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6OutcomeIntelligence");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_outcomes_control_effectiveness_total", 1).catch(
    () => undefined
  );

  const result = await computeOutcomeViews(ctx.admin, ctx.orgId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ controlEffectiveness: result.controlEffectiveness });
}
