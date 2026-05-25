import { NextResponse } from "next/server";
import { requireV6ApiFeature } from "@/lib/assurance/feature-guards";
import { requireV6Context } from "@/lib/assurance/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { buildAssuranceAnalyticsSummary } from "@/lib/assurance/assurance-analytics";
import { incrementAssuranceQualityCounter } from "@/lib/assurance/telemetry";

export async function GET() {
  const disabled = requireV6ApiFeature("v6AssuranceCore");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context();
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/assurance/analytics/summary",
  });
  if (modeGate) return modeGate;

  await incrementAssuranceQualityCounter(ctx.admin, ctx.orgId, "api_get_assurance_analytics_summary_total", 1).catch(
    () => undefined
  );

  const summary = await buildAssuranceAnalyticsSummary(ctx.admin, ctx.orgId);
  return NextResponse.json({ summary });
}
