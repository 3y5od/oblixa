import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, Clock3, GitBranch, Users } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import {
  delegateContractApprovalForm,
  updateContractApprovalStatusForm,
} from "@/actions/approvals";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function ApprovalsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await props.searchParams;
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId } = ctx;

  const query = admin
    .from("contract_approvals")
    .select("id, contract_id, approval_type, status, notes, category, due_at, exception_flag, exception_reason, approver_id, delegated_to_id, created_at, contracts!inner(id, title, organization_id)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query.eq("status", status);
  }

  const [{ data: approvals }, { data: scenarios }, { data: membersData }] = await Promise.all([
    query,
    admin
      .from("contract_renewal_scenarios")
      .select("id, contract_id, scenario, workspace_status, target_decision_date, escalation_date, blocker, updated_at, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("organization_members")
      .select("user_id, profiles(full_name, email)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
  ]);
  const memberOptions = (membersData ?? []).map((member) => {
    const profile = member.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return { id: member.user_id, label: profile?.full_name || profile?.email || "Member" };
  });
  const pendingApprovals = (approvals ?? []).filter((row) => row.status === "pending").length;
  const approvedApprovals = (approvals ?? []).filter((row) => row.status === "approved").length;
  const delegatedApprovals = (approvals ?? []).filter((row) => Boolean(row.delegated_to_id)).length;
  const blockedScenarios = (scenarios ?? []).filter((row) => Boolean(row.blocker)).length;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Decision controls</p>
          <h1 className="ui-display-title mt-2">Approvals & scenarios</h1>
          <p className="ui-page-lead mt-2">
            Approval signoff and renewal scenario status.
          </p>
        </div>
        <div className="ui-page-actions">
          <Link href="/contracts/approvals/workload" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Workload view
          </Link>
          <Link href="/contracts/approvals/sla-simulator" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            SLA simulator
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OperationalSummaryCard
          eyebrow="Queue"
          headline="Pending approvals"
          tone={pendingApprovals > 0 ? "attention" : "healthy"}
          icon={Clock3}
          primaryValue={pendingApprovals}
          primaryUnit="awaiting signoff"
          action={{ href: "/contracts/approvals?status=pending", label: "Open pending" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Completed"
          headline="Approved"
          tone="healthy"
          icon={CheckCircle2}
          primaryValue={approvedApprovals}
          primaryUnit="approved in this slice"
          action={{ href: "/contracts/approvals?status=approved", label: "Review approved" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Routing"
          headline="Delegated"
          tone={delegatedApprovals > 0 ? "neutral" : "healthy"}
          icon={Users}
          primaryValue={delegatedApprovals}
          primaryUnit="delegation in play"
          action={{ href: "/contracts/approvals", label: "Review routing" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Scenarios"
          headline="Blocked scenarios"
          tone={blockedScenarios > 0 ? "risk" : "healthy"}
          icon={GitBranch}
          primaryValue={blockedScenarios}
          primaryUnit="need unblock plan"
          action={{ href: "/contracts/approvals", label: "Inspect scenarios" }}
          variant="compact"
        />
      </section>

      <div className="ui-page-shell md:p-6">
        <div className="mb-4 space-y-1.5">
          <p className="ui-eyebrow">Filters</p>
          <h2 className="ui-section-title">Control the queue</h2>
          <p className="ui-support-copy">Focus on the approvals that still need a decision, then compare them against renewal scenario readiness below.</p>
        </div>
        <form action="/contracts/approvals" method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="ui-label-caps" htmlFor="status">
              Approval status
            </label>
            <select id="status" name="status" defaultValue={status ?? ""} className="ui-input min-w-[14rem]">
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button className="ui-btn-primary px-5 py-2.5 text-[13px]" type="submit">
            Apply
          </button>
        </form>
      </div>

      <section className="ui-page-shell overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <p className="ui-eyebrow">Queue</p>
          <h2 className="ui-section-title mt-1 text-[1.1rem]">Approval queue</h2>
          <p className="ui-support-copy mt-1">Use this as the execution queue for signoff, delegation, and exception-aware decision pressure.</p>
        </div>
        {(approvals?.length ?? 0) === 0 ? (
          <div className="px-6 py-6">
            <EmptyState title="No approvals found" copy="No approval rows match this filter." />
          </div>
        ) : (
          <ul className="space-y-3 px-4 py-4 md:px-6">
            {approvals?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              return (
                <li key={row.id} className="ui-operational-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="ui-kicker">Approval</p>
                      <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                        {row.approval_type.replace(/_/g, " ")} ·{" "}
                        {contract ? (
                          <Link className="ui-link" href={`/contracts/${contract.id}`}>
                            {contract.title}
                          </Link>
                        ) : (
                          "Contract"
                        )}
                      </p>
                      <p className="ui-support-copy mt-1.5">
                        {format(new Date(row.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2" role="list">
                        {row.category ? <span className="ui-metric-chip"><span className="ui-meta">Category</span><span>{row.category}</span></span> : null}
                        {row.due_at ? (
                          <span className="ui-metric-chip">
                            <span className="ui-meta">SLA due</span>
                            <span>{format(new Date(row.due_at), "MMM d, h:mm a")}</span>
                          </span>
                        ) : null}
                        {row.delegated_to_id ? (
                          <span className="ui-metric-chip">
                            <span className="ui-meta">Delegated</span>
                            <span>{row.delegated_to_id}</span>
                          </span>
                        ) : null}
                      </div>
                      {row.notes && <p className="ui-support-copy mt-2">{row.notes}</p>}
                      {row.exception_flag && (
                        <p className="ui-support-copy mt-2 text-amber-700">
                          Exception: {row.exception_reason || "No reason provided"}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={row.status === "rejected" ? "blocked" : row.status === "approved" ? "healthy" : "in_review"}>
                        {row.status}
                      </StatusBadge>
                      {row.status === "pending" && (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <form action={updateContractApprovalStatusForm}>
                            <input type="hidden" name="approvalId" value={row.id} />
                            <input type="hidden" name="status" value="approved" />
                            <button type="submit" className="ui-btn-secondary px-2.5 py-1 text-xs">
                              Approve
                            </button>
                          </form>
                          <form action={updateContractApprovalStatusForm}>
                            <input type="hidden" name="approvalId" value={row.id} />
                            <input type="hidden" name="status" value="rejected" />
                            <button type="submit" className="ui-btn-secondary px-2.5 py-1 text-xs">
                              Reject
                            </button>
                          </form>
                          {ctx.role === "admin" && (
                            <form action={delegateContractApprovalForm} className="flex items-center gap-1">
                              <input type="hidden" name="approvalId" value={row.id} />
                              <select name="delegateToUserId" defaultValue="" className="ui-input h-7 w-36 text-[11px]">
                                <option value="">delegate to...</option>
                                {memberOptions.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.label}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className="ui-btn-secondary px-2.5 py-1 text-xs">
                                Delegate
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ui-page-shell overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-6 py-4">
          <p className="ui-eyebrow">Scenarios</p>
          <h2 className="ui-section-title mt-1 text-[1.1rem]">Renewal scenarios</h2>
          <p className="ui-support-copy mt-1">Keep approval timing aligned with scenario blockers, escalation dates, and target decisions.</p>
        </div>
        {(scenarios?.length ?? 0) === 0 ? (
          <div className="px-6 py-6">
            <EmptyState title="No renewal scenarios" copy="No scenario rows recorded yet." />
          </div>
        ) : (
          <ul className="space-y-3 px-4 py-4 md:px-6">
            {scenarios?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              return (
                <li key={row.id} className="ui-operational-card p-4">
                  <p className="ui-kicker">Scenario</p>
                  <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                    {row.scenario.replace(/_/g, " ")} ·{" "}
                    {contract ? (
                      <Link className="ui-link" href={`/contracts/${contract.id}`}>
                        {contract.title}
                      </Link>
                    ) : (
                      "Contract"
                    )}
                  </p>
                  <p className="ui-support-copy mt-1.5">
                    Updated {format(new Date(row.updated_at), "MMM d, yyyy h:mm a")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2" role="list">
                    {row.workspace_status ? (
                      <span className="ui-metric-chip">
                        <span className="ui-meta">Workspace</span>
                        <span>{row.workspace_status}</span>
                      </span>
                    ) : null}
                    {row.target_decision_date ? (
                      <span className="ui-metric-chip">
                        <span className="ui-meta">Target decision</span>
                        <span>{format(new Date(`${row.target_decision_date}T12:00:00`), "MMM d, yyyy")}</span>
                      </span>
                    ) : null}
                  </div>
                  {row.escalation_date && (
                    <p className="ui-support-copy mt-2 text-amber-700">
                      Escalation:{" "}
                      {format(new Date(`${row.escalation_date}T12:00:00`), "MMM d, yyyy")}
                    </p>
                  )}
                  {row.blocker && <p className="ui-support-copy mt-2 text-amber-700">Blocker: {row.blocker}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
