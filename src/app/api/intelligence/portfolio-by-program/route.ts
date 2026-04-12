import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { getPortfolioByProgramRows } from "@/lib/v5/portfolio-analytics";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

/** Grounded workload by active program assignment (§16-style portfolio analytics). */
export async function GET() {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/intelligence/portfolio-by-program",
  });
  if (modeGate) return modeGate;

  const { programs, error } = await getPortfolioByProgramRows(ctx.admin, ctx.orgId);
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({
    programs,
    linked_refs: [{ ref_type: "table", ref_id: "contract_program_assignments" }],
  });
}
