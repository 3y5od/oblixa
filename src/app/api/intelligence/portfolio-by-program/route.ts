import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";
import { getPortfolioByProgramRows } from "@/lib/decision-intelligence/portfolio-analytics";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const ROUTE = "/api/intelligence/portfolio-by-program";

/** Grounded workload by active program assignment (§16-style portfolio analytics). */
export async function GET() {
  const disabled = requireV5ApiFeature("v5SimulationAndIntelligence");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/intelligence/portfolio-by-program",
  });
  if (modeGate) return modeGate;

  const { programs, error } = await getPortfolioByProgramRows(ctx.admin, ctx.orgId);
  if (error) {
    return jsonProblem(400, {
      error,
      code: "portfolio_by_program_failed",
      diagnostic_id: "portfolio_by_program_failed",
      route: ROUTE,
    });
  }

  return NextResponse.json({
    programs,
    linked_refs: [{ ref_type: "table", ref_id: "contract_program_assignments" }],
  });
}
