import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { getPortfolioByCounterpartyRows } from "@/lib/v5/portfolio-analytics";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

/** Open exception load grouped by contract counterparty_key (§16). */
export async function GET() {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/intelligence/portfolio-by-counterparty",
  });
  if (modeGate) return modeGate;

  const { counterparties, error } = await getPortfolioByCounterpartyRows(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({
    counterparties,
    linked_refs: [{ ref_type: "table", ref_id: "exceptions" }],
  });
}
