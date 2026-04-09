import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { ContractTable } from "@/components/contracts/contract-table";
import { MissingFieldsSection } from "@/components/dashboard/missing-fields-section";
import { UsageSection } from "@/components/dashboard/usage-section";
import { MyTasks } from "@/components/dashboard/my-tasks";
import { MyObligations } from "@/components/dashboard/my-obligations";
import { UpcomingActions } from "@/components/dashboard/upcoming-actions";
import { CONTRACT_LIST_ROW_COLUMNS } from "@/lib/contract-list";
import { attachOwnerProfiles } from "@/lib/contracts";
import {
  getDashboardDateFieldsCached,
  getDashboardMissingCriticalCached,
  getDashboardOrgMetricsCached,
  getDashboardUsageStatsCached,
  getDashboardWorkflowSettingsCached,
} from "@/lib/dashboard-data";
import { createAdminClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";
import { setDashboardQueuePinForm } from "@/actions/dashboard";
import { CommandCenterRoleMetrics } from "@/components/v4/command-center-role-metrics";
import type { WorkspaceRole } from "@/lib/navigation";

type DashboardDeadlineField = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export async function DashboardLower(props: {
  orgId: string;
  userId: string;
  role: WorkspaceRole;
  view: "personal" | "team" | "portfolio";
  quickFilter: "all" | "approvals" | "deadlines" | "data_gaps";
}) {
  const { orgId, userId, role, view, quickFilter } = props;
  const admin = await createAdminClient();

  const obligationPromise =
    view === "personal"
      ? admin
          .from("contract_obligations")
          .select(
            "id, title, status, due_date, obligation_type, contracts!inner(id, title, organization_id)"
          )
          .eq("organization_id", orgId)
          .eq("owner_id", userId)
          .in("status", ["open", "in_progress"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(8)
      : Promise.resolve({ data: [] as unknown[] });

  const pendingPromise =
    view === "team"
      ? admin
          .from("contracts")
          .select("id, title, counterparty")
          .eq("organization_id", orgId)
          .eq("status", "pending_review")
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as { id: string; title: string; counterparty: string | null }[] });

  const [
    metrics,
    missingCritical,
    dateFieldsData,
    workflowSettings,
    { data: myTasksData },
    { data: myObligationsData },
    { data: pendingContractsData },
    { data: recentContractsData },
    usageStats,
  ] = await Promise.all([
    getDashboardOrgMetricsCached(orgId),
    getDashboardMissingCriticalCached(orgId),
    getDashboardDateFieldsCached(orgId),
    getDashboardWorkflowSettingsCached(orgId),
    admin
      .from("contract_tasks")
      .select(
        "id, title, status, priority, due_date, contracts!inner(id, title, organization_id)"
      )
      .eq("organization_id", orgId)
      .eq("assignee_id", userId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    obligationPromise,
    pendingPromise,
    admin
      .from("contracts")
      .select(CONTRACT_LIST_ROW_COLUMNS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    getDashboardUsageStatsCached(orgId),
  ]);

  const recentContracts = await attachOwnerProfiles(admin, recentContractsData ?? []);
  const pendingContracts = pendingContractsData ?? [];
  const dateFields = dateFieldsData as unknown as DashboardDeadlineField[];

  const today = new Date();
  const nowTs = today.getTime();
  const upcomingActions = dateFields
    .filter((field) => field.field_value)
    .map((field) => {
      const dateValue = new Date(field.field_value as string);
      if (!isValid(dateValue)) return null;
      const daysUntil = differenceInDays(dateValue, today);
      if (Number.isNaN(daysUntil)) return null;
      return {
        contract: field.contracts,
        field: {
          id: field.id,
          field_name: field.field_name,
          field_value: field.field_value,
        },
        daysUntil,
      };
    })
    .filter(
      (a): a is NonNullable<typeof a> =>
        a != null && a.daysUntil >= 0 && a.daysUntil <= 90
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 10);

  const soonActions = upcomingActions.filter((a) => a.daysUntil <= 14);
  const riskContracts = missingCritical.slice(0, 6);
  const dashboardPins = ((workflowSettings?.dashboard_pins_json as Record<string, unknown> | null) ??
    {}) as Record<string, boolean>;
  const nowPinned = dashboardPins.now === true;
  const nextPinned = dashboardPins.next === true;
  const riskPinned = dashboardPins.risk === true;
  const filteredSoonActions =
    quickFilter === "all" || quickFilter === "deadlines" ? soonActions : [];
  const filteredRiskContracts =
    quickFilter === "all" || quickFilter === "data_gaps" ? riskContracts : [];
  const filteredPendingContracts =
    quickFilter === "all" || quickFilter === "approvals" ? pendingContracts : [];

  const myTasks = (myTasksData ?? []).flatMap((row) => {
    const rel = (row as { contracts: unknown }).contracts;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; organization_id?: string } | null;
    if (!contract?.id || !contract?.title || !contract?.organization_id) {
      return [];
    }
    return [
      {
        id: String((row as { id: unknown }).id),
        title: String((row as { title: unknown }).title),
        status: (row as { status: "open" | "in_progress" | "blocked" | "done" }).status,
        priority: (row as { priority: "low" | "medium" | "high" }).priority,
        due_date: (row as { due_date: string | null }).due_date,
        contracts: {
          id: contract.id,
          title: contract.title,
          organization_id: contract.organization_id,
        },
      },
    ];
  });
  const myObligations = (myObligationsData ?? []).flatMap((row) => {
    const rel = (row as { contracts: unknown }).contracts;
    const contract = (
      Array.isArray(rel) ? rel[0] : rel
    ) as { id?: string; title?: string; organization_id?: string } | null;
    if (!contract?.id || !contract?.title || !contract?.organization_id) {
      return [];
    }
    return [
      {
        id: String((row as { id: unknown }).id),
        title: String((row as { title: unknown }).title),
        status: (row as { status: "open" | "in_progress" | "done" | "waived" }).status,
        due_date: (row as { due_date: string | null }).due_date,
        obligation_type: String((row as { obligation_type: unknown }).obligation_type),
        contracts: {
          id: contract.id,
          title: contract.title,
          organization_id: contract.organization_id,
        },
      },
    ];
  });
  const overduePersonalTasks = myTasks.filter((task) => {
    if (!task.due_date) return false;
    return new Date(task.due_date).getTime() < nowTs;
  });

  return (
    <>
      <CommandCenterRoleMetrics orgId={orgId} role={role} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="ui-card overflow-hidden xl:col-span-1">
          <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-4 py-3.5 md:px-5 md:py-4">
            <h2 className="ui-section-title">Now</h2>
            <p className="mt-1 text-[11px] text-zinc-500 md:text-[12px]">
              Immediate actions requiring attention today
            </p>
            <div className="mt-2">
              <form action={setDashboardQueuePinForm}>
                <input type="hidden" name="queueKey" value="now" />
                <input type="hidden" name="pinned" value={nowPinned ? "0" : "1"} />
                <button type="submit" className="text-[11px] text-zinc-500 hover:text-zinc-800">
                  {nowPinned ? "Unpin queue" : "Pin queue"}
                </button>
              </form>
            </div>
          </div>
          <div className="space-y-4 px-4 py-4 md:space-y-5 md:px-5 md:py-5">
            {view === "personal" ? (
              <MyTasks tasks={myTasks.slice(0, 5)} />
            ) : view === "team" ? (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Review queue
                </p>
                <ul className="mt-2 space-y-2">
                  {filteredPendingContracts.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/contracts/${c.id}`}
                        className="block rounded-lg border border-zinc-200/80 px-3 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50 md:text-sm"
                      >
                        <p className="truncate font-semibold text-zinc-900">{c.title}</p>
                        <p className="text-[12px] text-zinc-500">
                          {c.counterparty || "No counterparty"}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          Why: pending review requires triage ownership.
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-zinc-600">
                <p>
                  Open tasks:{" "}
                  <span className="font-semibold text-zinc-900">{metrics.teamOpenTasks}</span>
                </p>
                <p>
                  Open obligations:{" "}
                  <span className="font-semibold text-zinc-900">
                    {metrics.teamOpenObligations}
                  </span>
                </p>
                <p>
                  At-risk contracts:{" "}
                  <span className="font-semibold text-zinc-900">
                    {metrics.atRiskContracts}
                  </span>
                </p>
              </div>
            )}
            {overduePersonalTasks.length > 0 && (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
                {overduePersonalTasks.length} overdue personal task
                {overduePersonalTasks.length === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        </section>

        <section className="ui-card overflow-hidden xl:col-span-1">
          <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-4 py-3.5 md:px-5 md:py-4">
            <h2 className="ui-section-title">Next</h2>
            <p className="mt-1 text-[11px] text-zinc-500 md:text-[12px]">
              Upcoming deadlines and obligations in the next two weeks
            </p>
            <div className="mt-2">
              <form action={setDashboardQueuePinForm}>
                <input type="hidden" name="queueKey" value="next" />
                <input type="hidden" name="pinned" value={nextPinned ? "0" : "1"} />
                <button type="submit" className="text-[11px] text-zinc-500 hover:text-zinc-800">
                  {nextPinned ? "Unpin queue" : "Pin queue"}
                </button>
              </form>
            </div>
          </div>
          <div className="space-y-4 px-4 py-4 md:space-y-5 md:px-5 md:py-5">
            <UpcomingActions actions={filteredSoonActions} />
            {view === "personal" ? (
              <MyObligations obligations={myObligations.slice(0, 5)} />
            ) : view === "team" ? (
              <p className="text-[12px] text-zinc-500">
                Switch to Personal mode for your assigned obligations.
              </p>
            ) : (
              <p className="text-[12px] text-zinc-500">
                Portfolio mode emphasizes global pipeline and risk rather than individual
                ownership.
              </p>
            )}
          </div>
        </section>

        <section className="ui-card overflow-hidden xl:col-span-1">
          <div className="border-b border-zinc-100/90 bg-zinc-50/40 px-4 py-3.5 md:px-5 md:py-4">
            <h2 className="ui-section-title">Risk</h2>
            <p className="mt-1 text-[11px] text-zinc-500 md:text-[12px]">
              Exceptions, missing critical fields, and renewal risk signals
            </p>
            <div className="mt-2">
              <form action={setDashboardQueuePinForm}>
                <input type="hidden" name="queueKey" value="risk" />
                <input type="hidden" name="pinned" value={riskPinned ? "0" : "1"} />
                <button type="submit" className="text-[11px] text-zinc-500 hover:text-zinc-800">
                  {riskPinned ? "Unpin queue" : "Pin queue"}
                </button>
              </form>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4 md:px-5 md:py-5">
            <Link
              href="/contracts/exceptions"
              className="block rounded-lg border border-zinc-200/80 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              <span className="font-semibold text-zinc-900">Exceptions</span>
              <p className="text-[12px] text-zinc-500">Review stale records and workflow gaps.</p>
              <p className="text-[11px] text-zinc-400">
                Why: unresolved exceptions hide execution risk.
              </p>
            </Link>
            <Link
              href="/contracts/approvals"
              className="block rounded-lg border border-zinc-200/80 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              <span className="font-semibold text-zinc-900">Pending approvals</span>
              <p className="text-[12px] text-zinc-500">Resolve queued approvals and blockers.</p>
              <p className="text-[11px] text-zinc-400">
                Why: stalled approvals block downstream actions.
              </p>
            </Link>
            <div className="rounded-lg border border-zinc-200/80 px-3 py-2 text-sm">
              <span className="font-semibold text-zinc-900">
                {filteredRiskContracts.length} contracts missing key dates
              </span>
              <p className="text-[12px] text-zinc-500">
                End/renewal/notice fields still need approved values.
              </p>
              <p className="text-[11px] text-zinc-400">
                Why: missing dates weaken reminder and renewal orchestration.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="ui-section-title text-base">Recent contracts</h2>
            <p className="mt-1 text-[12px] text-zinc-500 md:text-[13px]">
              Latest activity in your workspace
            </p>
          </div>
          <Link href="/contracts" className="ui-link text-[13px]">
            View all contracts
          </Link>
        </div>
        <ContractTable contracts={recentContracts as Contract[]} />
      </section>

      <details className="ui-card overflow-hidden">
        <summary className="cursor-pointer list-none border-b border-zinc-100 bg-zinc-50/60 px-5 py-3.5 text-[13px] font-semibold text-zinc-700 marker:hidden md:px-6 md:py-4 md:text-sm">
          Portfolio diagnostics and usage
        </summary>
        <div className="space-y-7 px-5 py-4 md:space-y-8 md:px-6 md:py-5">
          <UsageSection
            contractsCreated={usageStats.contractsCreated}
            extractionsRun={usageStats.extractionsRun}
            fieldsReviewed={usageStats.fieldsReviewed}
            periodLabel={usageStats.periodLabel}
          />
          <MissingFieldsSection contracts={missingCritical} />
        </div>
      </details>
    </>
  );
}
