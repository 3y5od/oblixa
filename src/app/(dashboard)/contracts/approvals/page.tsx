import Link from "next/link";
import { format } from "date-fns";
import { getAuthContext } from "@/lib/supabase/server";
import {
  delegateContractApprovalForm,
  updateContractApprovalStatusForm,
} from "@/actions/approvals";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
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

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Decision controls</p>
          <h1 className="ui-display-title mt-2">Approvals & scenarios</h1>
          <p className="ui-muted-tight mt-2 max-w-2xl">
            Approval signoff and renewal scenario status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contracts/approvals/workload" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            Workload view
          </Link>
          <Link href="/contracts/approvals/sla-simulator" className="ui-btn-secondary px-4 py-2.5 text-[13px]">
            SLA simulator
          </Link>
        </div>
      </header>

      <div className="ui-panel md:p-6">
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

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <p className="ui-eyebrow">Queue</p>
          <h2 className="ui-section-title mt-1 text-base">Approval queue</h2>
        </div>
        {(approvals?.length ?? 0) === 0 ? (
          <div className="px-6 py-6">
            <EmptyState title="No approvals found" copy="No approval rows match this filter." />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {approvals?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              return (
                <li key={row.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {row.approval_type.replace(/_/g, " ")} ·{" "}
                        {contract ? (
                          <Link className="ui-link" href={`/contracts/${contract.id}`}>
                            {contract.title}
                          </Link>
                        ) : (
                          "Contract"
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {format(new Date(row.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                      {row.category && (
                        <p className="mt-1 text-xs text-zinc-500">Category: {row.category}</p>
                      )}
                      {row.due_at && (
                        <p className="mt-1 text-xs text-zinc-500">
                          SLA due {format(new Date(row.due_at), "MMM d, yyyy h:mm a")}
                        </p>
                      )}
                      {row.notes && <p className="mt-1 text-xs text-zinc-600">{row.notes}</p>}
                      {row.exception_flag && (
                        <p className="mt-1 text-xs text-amber-700">
                          Exception: {row.exception_reason || "No reason provided"}
                        </p>
                      )}
                      {row.delegated_to_id && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Delegated to: {row.delegated_to_id}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={row.status === "rejected" ? "blocked" : row.status === "approved" ? "healthy" : "in_review"}>
                        {row.status}
                      </StatusBadge>
                      {row.status === "pending" && (
                        <div className="flex items-center gap-2">
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

      <section className="ui-card overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
          <p className="ui-eyebrow">Scenarios</p>
          <h2 className="ui-section-title mt-1 text-base">Renewal scenarios</h2>
        </div>
        {(scenarios?.length ?? 0) === 0 ? (
          <div className="px-6 py-6">
            <EmptyState title="No renewal scenarios" copy="No scenario rows recorded yet." />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {scenarios?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              return (
                <li key={row.id} className="px-6 py-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {row.scenario.replace(/_/g, " ")} ·{" "}
                    {contract ? (
                      <Link className="ui-link" href={`/contracts/${contract.id}`}>
                        {contract.title}
                      </Link>
                    ) : (
                      "Contract"
                    )}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Updated {format(new Date(row.updated_at), "MMM d, yyyy h:mm a")}
                  </p>
                  {row.workspace_status && (
                    <p className="mt-1 text-xs text-zinc-500">Workspace: {row.workspace_status}</p>
                  )}
                  {row.target_decision_date && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Target decision:{" "}
                      {format(new Date(`${row.target_decision_date}T12:00:00`), "MMM d, yyyy")}
                    </p>
                  )}
                  {row.escalation_date && (
                    <p className="mt-1 text-xs text-amber-700">
                      Escalation:{" "}
                      {format(new Date(`${row.escalation_date}T12:00:00`), "MMM d, yyyy")}
                    </p>
                  )}
                  {row.blocker && <p className="mt-1 text-xs text-amber-700">Blocker: {row.blocker}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
