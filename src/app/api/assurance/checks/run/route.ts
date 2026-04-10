import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runChecks } from "@/lib/v6/assurance";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function POST() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("maintenance_manage");
  if (!ctx) return errorResponse!;

  const result = await runChecks(ctx.admin, ctx.orgId, ctx.userId);
  if (result.errors.length) {
    return NextResponse.json({ error: String(result.errors[0]) }, { status: 400 });
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_assurance_checks_run_total");
  return NextResponse.json({ checkRun: result.checkRun, finding: result.finding }, { status: 201 });
}
