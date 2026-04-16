import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
