import { NextResponse } from "next/server";
import { jsonUnauthorized } from "@/lib/http/problem";
import { getApiAuthContext } from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

const ROUTE = "/api/approvals/sla-metrics";

export async function GET() {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/approvals/sla-metrics",
  });
  if (modeGate) return modeGate;

  const [{ data: approvals }, { data: slas }] = await Promise.all([
    ctx.admin
      .from("contract_approvals")
      .select("id, status, created_at, completed_at, approval_type")
      .eq("organization_id", ctx.orgId)
      .limit(2000),
    ctx.admin
      .from("approval_slas")
      .select("approval_type, contract_type, sla_hours")
      .eq("organization_id", ctx.orgId)
      .eq("active", true),
  ]);

  const slaByType = new Map<string, number>();
  for (const row of slas ?? []) {
    if (!slaByType.has(row.approval_type)) {
      slaByType.set(row.approval_type, Number(row.sla_hours));
    }
  }

  let completed = 0;
  let withinSla = 0;
  let totalHours = 0;
  for (const row of approvals ?? []) {
    if (row.status !== "approved" || !row.completed_at) continue;
    const created = new Date(row.created_at).getTime();
    const completedAt = new Date(row.completed_at).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(completedAt)) continue;
    const hours = Math.max(0, (completedAt - created) / 3_600_000);
    const slaHours = slaByType.get(row.approval_type) ?? 72;
    completed += 1;
    totalHours += hours;
    if (hours <= slaHours) withinSla += 1;
  }

  return NextResponse.json({
    metrics: {
      approvalsCompleted: completed,
      averageApprovalHours: completed > 0 ? Number((totalHours / completed).toFixed(2)) : 0,
      withinSlaRate: completed > 0 ? Number(((withinSla / completed) * 100).toFixed(2)) : 0,
    },
  });
}
