import type { createAdminClient } from "@/lib/supabase/server";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return Number(v) || 0;
}

const PRIOR_KEYS = [
  "total_contracts",
  "pending_review",
  "active_contracts",
  "at_risk_contracts",
  "open_tasks",
  "open_obligations",
  "open_exceptions",
  "pending_approvals",
  "approvals_past_due",
] as const;

export function extractPriorKpis(metrics: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PRIOR_KEYS) {
    if (k in metrics) out[k] = metrics[k];
  }
  return out;
}

export async function computeReportPackMetrics(input: {
  admin: AdminClient;
  organizationId: string;
  reportType: string;
  workspaceProductMode?: WorkspaceProductMode;
}): Promise<Record<string, unknown>> {
  const { admin, organizationId, reportType } = input;
  const mode = input.workspaceProductMode ?? "core";
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const { data: dashData, error: dashErr } = await admin.rpc("dashboard_org_metrics", {
    p_org_id: organizationId,
  });
  const dashRow = Array.isArray(dashData) ? dashData[0] : dashData;
  const d = (dashRow && typeof dashRow === "object" ? dashRow : {}) as Record<string, unknown>;
  const base = {
    total_contracts: num(d.total_contracts),
    pending_review: num(d.pending_review),
    active_contracts: num(d.active_contracts),
    at_risk_contracts: num(d.at_risk),
    open_tasks: num(d.open_tasks),
    open_obligations: num(d.open_obligations),
    extracted_fields_total: num(d.extracted_fields_total),
    approved_operational_date_fields: num(d.approved_operational_date_fields),
  };

  const [
    { count: openExceptions },
    { count: pendingApprovals },
    { count: approvalsPastDue },
    { count: activePrograms },
    { count: graphEdges },
  ] = await Promise.all([
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending"),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lt("due_at", nowIso),
    admin
      .from("contract_program_assignments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    admin
      .from("execution_graph_edges")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active"),
  ]);

  const { count: overdueTaskCount } = await admin
    .from("contract_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["open", "in_progress", "blocked"])
    .lt("due_date", today);

  const core = {
    ...base,
    open_exceptions: openExceptions ?? 0,
    pending_approvals: pendingApprovals ?? 0,
    approvals_past_due: approvalsPastDue ?? 0,
    overdue_tasks: overdueTaskCount ?? 0,
    generated_at: nowIso,
    report_type: reportType,
    dashboard_rpc_ok: !dashErr,
  };
  const withAdvanced =
    mode === "advanced" || mode === "assurance"
      ? {
          ...core,
          active_program_assignments: activePrograms ?? 0,
          active_execution_edges: graphEdges ?? 0,
        }
      : core;

  const RENEWAL_TYPES = ["monthly_renewal_readiness", "renewal_status", "renewal_portfolio"];
  const EXCEPTION_TYPES = ["exception_summary", "exception_detail", "exception_review"];
  const APPROVAL_SLA_TYPES = ["approval_summary", "approval_status", "sla_performance", "sla_compliance"];
  const OBLIGATION_TYPES = ["obligation_summary", "obligation_status", "obligation_compliance"];

  if (RENEWAL_TYPES.includes(reportType)) {
    const { count: renewalPending } = await admin
      .from("contract_renewal_checkpoints")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending");
    const { count: decisionPending } = await admin
      .from("contract_renewal_checkpoints")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("renewal_state", "decision_pending");
    return {
      ...withAdvanced,
      renewal_checkpoints_pending: renewalPending ?? 0,
      renewal_decision_pending_checkpoints: decisionPending ?? 0,
    };
  }

  if (EXCEPTION_TYPES.includes(reportType)) {
    const { count: criticalEx } = await admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"])
      .eq("severity", "critical");
    return { ...withAdvanced, open_exceptions_critical: criticalEx ?? 0 };
  }

  if (APPROVAL_SLA_TYPES.includes(reportType)) {
    return {
      ...withAdvanced,
      focus: "approvals_sla",
      approvals_past_due: approvalsPastDue ?? 0,
    };
  }

  if (OBLIGATION_TYPES.includes(reportType)) {
    const { count: overdueOb } = await admin
      .from("contract_obligations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress"])
      .lt("due_date", today);
    return { ...withAdvanced, obligations_overdue: overdueOb ?? 0 };
  }

  return withAdvanced;
}
