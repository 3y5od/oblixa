import { NextResponse } from "next/server";
import { jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { buildPortfolioSignalSummary } from "@/lib/v5/portfolio-signal-summary";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const ROUTE = "/api/intelligence/portfolio-signals";

export async function GET() {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/intelligence/portfolio-signals",
  });
  if (modeGate) return modeGate;

  const { signalSummary, drivers } = await buildPortfolioSignalSummary(ctx.admin, ctx.orgId);
  return NextResponse.json({ signalSummary, drivers });
}
