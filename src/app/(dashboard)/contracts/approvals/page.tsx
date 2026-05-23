import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  GitBranch,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import {
  delegateContractApprovalForm,
  updateContractApprovalStatusForm,
} from "@/actions/approvals";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SamplePreviewCard } from "@/components/ui/sample-preview-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell, type StatTone } from "@/components/ui/stat-cell";
import { StatusPill } from "@/components/ui/status-pill";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

export const metadata = { title: "Approvals" };

const APPROVAL_STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes requested" },
];

function formatOperatorLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .trim();
}

function approvalStatusTone(status: string): StatTone {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "changes_requested") return "warning";
  if (status === "pending") return "warning";
  return "neutral";
}

export default async function ApprovalsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await props.searchParams;
  const selectedStatus = APPROVAL_STATUS_FILTERS.some((filter) => filter.value === status) ? status ?? "" : "";
  const hasFilters = Boolean(selectedStatus);
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const { admin, orgId } = ctx;

  const query = admin
    .from("contract_approvals")
    .select("id, contract_id, approval_type, status, notes, category, due_at, exception_flag, exception_reason, approver_id, delegated_to_id, created_at, contracts!inner(id, title, organization_id)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (selectedStatus) {
    query.eq("status", selectedStatus);
  }

  const [{ data: approvals }, { data: scenarios }, membersData] = await Promise.all([
    query,
    admin
      .from("contract_renewal_scenarios")
      .select("id, contract_id, scenario, workspace_status, target_decision_date, escalation_date, blocker, updated_at, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    loadOrgMemberProfileRows(admin, orgId, { orderByCreatedAt: true }),
  ]);
  const memberOptions = (membersData ?? []).map((member) => {
    return { id: member.user_id, label: orgMemberProfileLabel(member.profiles) };
  });
  const pendingApprovals = (approvals ?? []).filter((row) => row.status === "pending").length;
  const approvedApprovals = (approvals ?? []).filter((row) => row.status === "approved").length;
  const delegatedApprovals = (approvals ?? []).filter((row) => Boolean(row.delegated_to_id)).length;
  const blockedScenarios = (scenarios ?? []).filter((row) => Boolean(row.blocker)).length;

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<ShieldCheck className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Decision controls"
        title="Approvals & scenarios"
        lead="Approval signoff and renewal scenario status."
        actions={
          <>
            <Link
              href="/contracts/approvals/workload"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              <Users className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Workload view
            </Link>
            <Link
              href="/contracts/approvals/sla-simulator"
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              <Clock3 className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              SLA simulator
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Approvals summary">
        <StatCell
          label="Pending approvals"
          display={String(pendingApprovals)}
          isZero={pendingApprovals === 0}
          tone="warning"
          context={pendingApprovals === 0 ? "No signoffs awaiting" : "Awaiting signoff"}
        />
        <StatCell
          label="Approved"
          display={String(approvedApprovals)}
          isZero={approvedApprovals === 0}
          tone="success"
          context={approvedApprovals === 0 ? "Nothing approved yet" : "Closed in this view"}
        />
        <StatCell
          label="Delegated"
          display={String(delegatedApprovals)}
          isZero={delegatedApprovals === 0}
          tone="neutral"
          context={delegatedApprovals === 0 ? "Nothing routed elsewhere" : "Routed to alternates"}
        />
        <StatCell
          label="Blocked scenarios"
          display={String(blockedScenarios)}
          isZero={blockedScenarios === 0}
          tone="danger"
          context={blockedScenarios === 0 ? "No unblock plans needed" : "Need an unblock plan"}
        />
      </section>

      <section className="ui-card overflow-hidden p-0">
        <SectionHeader
          eyebrow="Filters"
          trailing={
            hasFilters ? (
              <Link
                href="/contracts/approvals"
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Clear filters
              </Link>
            ) : null
          }
        />
        <form action="/contracts/approvals" method="get" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4">
          <fieldset className="contents">
            <legend className="sr-only">Approval status</legend>
            <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {APPROVAL_STATUS_FILTERS.map((filter) => (
                <label key={filter.value || "all"} className="cursor-pointer">
                  <input aria-label="Status" type="radio"
                    name="status"
                    value={filter.value}
                    defaultChecked={selectedStatus === filter.value}
                    className="peer sr-only"
                  />
                  <span className="inline-flex min-h-8 items-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_38%,transparent)] px-3 py-1 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:text-[var(--text-primary)] peer-checked:border-[color:color-mix(in_oklab,var(--accent)_60%,var(--border-strong))] peer-checked:bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] peer-checked:text-[var(--accent-strong)] peer-checked:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_28%,transparent)] peer-focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_40%,transparent),0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]">
                    {filter.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="ui-btn-primary ml-auto inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-[12.5px]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            Apply filters
          </button>
        </form>
      </section>

      {(approvals?.length ?? 0) === 0 ? (
        <section className="ui-card-raised relative overflow-hidden rounded-2xl border p-5 sm:p-6 lg:p-7">
          <div
            aria-hidden
            className="landing-corner-ring"
            style={{ top: "-2.25rem", right: "-2.25rem", width: "7rem", height: "7rem" }}
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
            <EmptyState
              eyebrow="Approval queue"
              title="No approvals match this queue"
              copy="Adjust the approval status filter, clear the queue, or review unified work for other decision pressure."
              icon={<Compass className="h-7 w-7 text-[var(--accent-strong)]" strokeWidth={1.65} aria-hidden />}
              className="lg:items-start lg:text-left"
              action={
                <>
                  <Link
                    href="/work"
                    className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    Review unified work
                  </Link>
                  {hasFilters ? (
                    <Link
                      href="/contracts/approvals"
                      className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                    >
                      Clear filters
                    </Link>
                  ) : (
                    <Link
                      href="/contracts/renewals"
                      className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]"
                    >
                      Browse renewals
                    </Link>
                  )}
                </>
              }
            />

            <SamplePreviewCard
              eyebrow="Sample approval"
              title="Renewal signoff · Acme Corp MSA 2025"
              meta={["Commercial", "≥ $50K"]}
              status={<StatusPill tone="warning">Pending</StatusPill>}
              rows={[
                { label: "Approver", value: "Sarah K." },
                { label: "SLA due", value: "Mar 18 · 5:00 PM" },
                { label: "Created", value: "Mar 11, 2026" },
                { label: "Category", value: "Commercial" },
              ]}
              footerValue="Approve, reject, or delegate"
            />
          </div>
        </section>
      ) : (
        <section className="ui-card overflow-hidden p-0">
          <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Queue
              </p>
              <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
                Approval queue
              </h2>
              <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                Execution queue for signoff, delegation, and exception-aware decision pressure.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <Clock3 className="h-3 w-3" strokeWidth={1.85} aria-hidden />
              {approvals?.length ?? 0} {(approvals?.length ?? 0) === 1 ? "row" : "rows"}
            </span>
          </header>
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
            {approvals?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              const stTone = approvalStatusTone(row.status);
              const memberLabel = row.delegated_to_id
                ? memberOptions.find((m) => m.id === row.delegated_to_id)?.label ?? "Member"
                : null;
              return (
                <li key={row.id} className="px-5 py-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]"
                        aria-hidden
                      >
                        <ShieldCheck className="h-4 w-4" strokeWidth={1.85} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                            {formatOperatorLabel(row.approval_type)}
                          </h3>
                          <StatusPill tone={stTone}>{formatOperatorLabel(row.status)}</StatusPill>
                          {row.exception_flag ? (
                            <StatusPill tone="warning">Exception</StatusPill>
                          ) : null}
                        </div>
                        {contract ? (
                          <Link
                            href={`/contracts/${contract.id}`}
                            className="ui-link mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold"
                          >
                            {contract.title}
                            <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
                          </Link>
                        ) : null}
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                          {format(new Date(row.created_at), "MMM d, yyyy · h:mm a")}
                        </p>
                        {row.notes ? (
                          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                            {row.notes}
                          </p>
                        ) : null}
                        {row.exception_flag ? (
                          <p className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] text-[var(--warning-ink)]">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
                            <span>{row.exception_reason || "Exception reason not provided"}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <dl className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-1.5 text-[11px] lg:max-w-[22rem] lg:justify-end">
                      {row.category ? (
                        <div className="inline-flex items-center gap-1.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            Category
                          </dt>
                          <dd className="font-medium text-[var(--text-secondary)]">
                            {formatOperatorLabel(row.category)}
                          </dd>
                        </div>
                      ) : null}
                      {row.due_at ? (
                        <div className="inline-flex items-center gap-1.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            SLA due
                          </dt>
                          <dd className="font-mono text-[var(--text-secondary)]">
                            {format(new Date(row.due_at), "MMM d · h:mm a")}
                          </dd>
                        </div>
                      ) : null}
                      {memberLabel ? (
                        <div className="inline-flex items-center gap-1.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            Delegated
                          </dt>
                          <dd className="font-medium text-[var(--text-secondary)]">{memberLabel}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>

                  {row.status === "pending" ? (
                    <div className="mt-4 space-y-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                        Decision
                      </p>
                      <form action={updateContractApprovalStatusForm} className="space-y-3">
                        <input type="hidden" name="approvalId" value={row.id} />
                        <div className="space-y-2">
                          <label
                            htmlFor={`approval-note-${row.id}`}
                            className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
                          >
                            Decision note
                          </label>
                          <textarea
                            id={`approval-note-${row.id}`}
                            name="notes"
                            className="ui-input min-h-[3.5rem] w-full text-[12.5px] leading-relaxed"
                            placeholder="Required for reject or request changes"
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="submit"
                            name="status"
                            value="changes_requested"
                            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
                          >
                            Request changes
                          </button>
                          <button
                            type="submit"
                            name="status"
                            value="rejected"
                            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] text-[var(--danger-ink)]"
                          >
                            Reject
                          </button>
                          <button
                            type="submit"
                            name="status"
                            value="approved"
                            className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                            Approve
                          </button>
                        </div>
                      </form>
                      {ctx.role === "admin" ? (
                        <form
                          action={delegateContractApprovalForm}
                          className="flex flex-col gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3 sm:flex-row sm:items-center sm:justify-end"
                        >
                          <input type="hidden" name="approvalId" value={row.id} />
                          <label
                            htmlFor={`approval-delegate-${row.id}`}
                            className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
                          >
                            Delegate to
                          </label>
                          <div className="flex flex-1 flex-wrap items-stretch gap-2 sm:max-w-[20rem]">
                            <select
                              id={`approval-delegate-${row.id}`}
                              name="delegateToUserId"
                              defaultValue=""
                              className="ui-input min-w-0 flex-1 text-[12.5px]"
                            >
                              <option value="">Select member…</option>
                              {memberOptions.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
                            >
                              <Users className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                              Delegate
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="ui-card overflow-hidden p-0">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
              Scenarios
            </p>
            <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
              Renewal scenarios
            </h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              Approval timing aligned with scenario blockers, escalation dates, and target decisions.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            <GitBranch className="h-3 w-3" strokeWidth={1.85} aria-hidden />
            {scenarios?.length ?? 0} {(scenarios?.length ?? 0) === 1 ? "scenario" : "scenarios"}
          </span>
        </header>
        {(scenarios?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,var(--surface-raised))] text-[var(--text-secondary)]"
                aria-hidden
              >
                <GitBranch className="h-4 w-4" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                  No renewal scenarios yet
                </p>
                <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                  Scenarios appear once contracts have decision timing, blockers, or renewal paths to compare against approvals.
                </p>
              </div>
            </div>
            <Link
              href="/contracts/renewals"
              className="ui-btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[12.5px]"
            >
              Review renewals
              <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
            {scenarios?.map((row) => {
              const contract = (Array.isArray(row.contracts) ? row.contracts[0] : row.contracts) as
                | { id: string; title: string }
                | undefined;
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]"
                        aria-hidden
                      >
                        <GitBranch className="h-4 w-4" strokeWidth={1.85} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                            {row.scenario.replace(/_/g, " ")}
                          </h3>
                          {row.blocker ? <StatusPill tone="warning">Blocked</StatusPill> : null}
                        </div>
                        {contract ? (
                          <Link
                            href={`/contracts/${contract.id}`}
                            className="ui-link mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold"
                          >
                            {contract.title}
                            <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
                          </Link>
                        ) : null}
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                          Updated {format(new Date(row.updated_at), "MMM d, yyyy · h:mm a")}
                        </p>
                        {row.blocker ? (
                          <p className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] text-[var(--warning-ink)]">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
                            <span>Blocker · {row.blocker}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <dl className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-1.5 text-[11px] lg:max-w-[22rem] lg:justify-end">
                      {row.workspace_status ? (
                        <div className="inline-flex items-center gap-1.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            Workspace
                          </dt>
                          <dd className="font-medium text-[var(--text-secondary)]">
                            {String(row.workspace_status).replace(/_/g, " ")}
                          </dd>
                        </div>
                      ) : null}
                      {row.target_decision_date ? (
                        <div className="inline-flex items-center gap-1.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            Target
                          </dt>
                          <dd className="font-mono text-[var(--text-secondary)]">
                            {format(new Date(`${row.target_decision_date}T12:00:00`), "MMM d, yyyy")}
                          </dd>
                        </div>
                      ) : null}
                      {row.escalation_date ? (
                        <div className="inline-flex items-center gap-1.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            Escalate
                          </dt>
                          <dd className="font-mono text-[var(--warning-ink)]">
                            {format(new Date(`${row.escalation_date}T12:00:00`), "MMM d, yyyy")}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
