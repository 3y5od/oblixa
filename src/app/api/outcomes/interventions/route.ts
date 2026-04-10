import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { computeOutcomeViews, listOutcomeInterventionsPaginated } from "@/lib/v6/outcomes";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function GET(request: Request) {
  const disabled = requireV6ApiFeature("v6OutcomeIntelligence");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_get_outcomes_interventions_total", 1).catch(
    () => undefined
  );

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

  const page = await listOutcomeInterventionsPaginated(ctx.admin, ctx.orgId, { limit, offset });
  if (page.error) return NextResponse.json({ error: page.error.message }, { status: 400 });

  const result = await computeOutcomeViews(ctx.admin, ctx.orgId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({
    interventionsPage: {
      rows: page.rows,
      total: page.total,
      limit,
      offset,
    },
    interventions: result.interventions,
    programEffectiveness: result.programEffectiveness,
    controlEffectiveness: result.controlEffectiveness,
    playbookEffectiveness: result.playbookEffectiveness,
    weeklyEffectiveness: result.weeklyEffectiveness ?? [],
    summary: result.summary,
  });
}
