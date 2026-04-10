import { NextResponse } from "next/server";
import { toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { simulateProgramEvolutionExperiment } from "@/lib/v6/program-evolution";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const id = toSafeString((await params).id);
  const result = await simulateProgramEvolutionExperiment(ctx.admin, ctx.orgId, ctx.userId, id);
  if (result.error) return NextResponse.json({ error: (result.error as { message?: string }).message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_program_evolution_simulate_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json(result);
}
