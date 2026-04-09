import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { buildPortfolioSignalSummary } from "@/lib/v5/portfolio-signal-summary";

export async function GET() {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { signalSummary, drivers } = await buildPortfolioSignalSummary(ctx.admin, ctx.orgId);
  return NextResponse.json({ signalSummary, drivers });
}
