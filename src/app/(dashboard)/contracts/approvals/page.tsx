import Link from "next/link";
import { Clock3, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell } from "@/components/ui/stat-cell";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import { ApprovalQueue } from "@/app/(dashboard)/contracts/approvals/approvals-queue";
import {
  APPROVAL_STATUS_FILTERS,
} from "@/app/(dashboard)/contracts/approvals/approvals-page-config";
import { RenewalScenariosSection } from "@/app/(dashboard)/contracts/approvals/approval-scenarios-section";
import type {
  ApprovalRow,
  MemberOption,
  RenewalScenarioRow,
} from "@/app/(dashboard)/contracts/approvals/approvals-page-types";

export const metadata = { title: "Approvals" };

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

  const [{ data: approvalsData }, { data: scenariosData }, membersData] = await Promise.all([
    query,
    admin
      .from("contract_renewal_scenarios")
      .select("id, contract_id, scenario, workspace_status, target_decision_date, escalation_date, blocker, updated_at, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(100),
    loadOrgMemberProfileRows(admin, orgId, { orderByCreatedAt: true }),
  ]);
  const approvals = (approvalsData ?? []) as ApprovalRow[];
  const scenarios = (scenariosData ?? []) as RenewalScenarioRow[];
  const memberOptions: MemberOption[] = (membersData ?? []).map((member) => ({
    id: member.user_id,
    label: orgMemberProfileLabel(member.profiles),
  }));
  const pendingApprovals = approvals.filter((row) => row.status === "pending").length;
  const approvedApprovals = approvals.filter((row) => row.status === "approved").length;
  const delegatedApprovals = approvals.filter((row) => Boolean(row.delegated_to_id)).length;
  const blockedScenarios = scenarios.filter((row) => Boolean(row.blocker)).length;

  return (
    <div className="ui-page-stack mx-auto max-w-7xl">
      <DashboardPageHeader
        icon={<ShieldCheck className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Decision controls"
        title="Approvals & scenarios"
        lead="Approval signoff and renewal scenario status."
        actions={
          <>
            <Link href="/contracts/approvals/workload" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
              <Users className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Workload view
            </Link>
            <Link href="/contracts/approvals/sla-simulator" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
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
          label="Scenarios needing input"
          display={String(blockedScenarios)}
          isZero={blockedScenarios === 0}
          tone="danger"
          context={blockedScenarios === 0 ? "No dependency plans needed" : "Need a dependency plan"}
        />
      </section>

      <section className="ui-card overflow-hidden p-0">
        <SectionHeader
          eyebrow="Filters"
          trailing={
            hasFilters ? (
              <Link href="/contracts/approvals" className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]">
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
                  <input
                    aria-label="Status"
                    type="radio"
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
          <button type="submit" className="ui-btn-primary ml-auto inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-[12.5px]">
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            Apply filters
          </button>
        </form>
      </section>

      <ApprovalQueue
        approvals={approvals}
        hasFilters={hasFilters}
        isAdmin={ctx.role === "admin"}
        memberOptions={memberOptions}
      />
      <RenewalScenariosSection scenarios={scenarios} />
    </div>
  );
}
