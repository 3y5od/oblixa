import { NextResponse } from "next/server";
import { jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const ROUTE = "/api/renewals/portfolio-signals";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/renewals/portfolio-signals",
  });
  if (modeGate) return modeGate;

  const { data: rows, error } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .select("id, status, due_date, renewal_state")
    .eq("organization_id", ctx.orgId)
    .limit(2000);
  if (error) {
    return jsonProblem(400, {
      error: error.message,
      code: "renewal_portfolio_signals_load_failed",
      diagnostic_id: "renewal_portfolio_signals_load_failed",
      route: ROUTE,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const totals = {
    total: rows?.length ?? 0,
    pending: 0,
    overdue: 0,
    completed: 0,
    decisionPending: 0,
  };
  for (const row of rows ?? []) {
    if (row.status === "completed") totals.completed += 1;
    if (row.status === "pending") totals.pending += 1;
    if (row.status !== "completed" && row.due_date && row.due_date < today) totals.overdue += 1;
    if (row.renewal_state === "decision_pending") totals.decisionPending += 1;
  }

  return NextResponse.json(
    { signals: totals },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
      },
    }
  );
}
