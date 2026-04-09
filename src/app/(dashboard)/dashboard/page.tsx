import { getAuthContext } from "@/lib/supabase/server";
import { differenceInDays, isValid } from "date-fns";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UpcomingActions } from "@/components/dashboard/upcoming-actions";
import { ContractTable } from "@/components/contracts/contract-table";
import { MissingFieldsSection } from "@/components/dashboard/missing-fields-section";
import { UsageSection } from "@/components/dashboard/usage-section";
import { MyTasks } from "@/components/dashboard/my-tasks";
import { MyObligations } from "@/components/dashboard/my-obligations";
import {
  OnboardingBanner,
  type OnboardingActivationStats,
} from "@/components/dashboard/onboarding-banner";
import { CONTRACT_LIST_ROW_COLUMNS } from "@/lib/contract-list";
import { attachOwnerProfiles } from "@/lib/contracts";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { getOrgUsageStats } from "@/lib/usage-stats";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import Link from "next/link";
import type { Contract } from "@/lib/types";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { setDashboardQueuePinForm } from "@/actions/dashboard";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";

/** Slim row from dashboard deadline query (no full ExtractedField / Contract payload). */
type DashboardDeadlineField = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export default async function DashboardPage(props: {
  searchParams: Promise<{ view?: string; qf?: string }>;
}) {
  const { view: rawView, qf: rawQuickFilter } = await props.searchParams;
  const view =
    rawView === "team" || rawView === "portfolio" || rawView === "personal"
      ? rawView
      : "personal";
  const quickFilter =
    rawQuickFilter === "approvals" ||
    rawQuickFilter === "deadlines" ||
    rawQuickFilter === "data_gaps"
      ? rawQuickFilter
      : "all";
  const ctx = await getAuthContext();
  if (!ctx) {
    return <WorkspaceRequiredState />;
  }

  const { orgId, admin, user } = ctx;
  const enforcePlan = isPlanEnforcementEnabled();

  const [
    { data: profileRow },
    { count: totalContracts },
    { count: pendingReview },
    { count: activeContracts },
    { data: recentContractsData },
    { data: pendingContractsData },
    { data: dateFieldsData },
    { count: extractedFieldsCount },
    { count: approvedOperationalDatesCount },
    missingCritical,
    usageStats,
    hasActivePlan,
    { data: myTasksData },
    { data: myObligationsData },
    { count: teamOpenTasksCount },
    { count: teamOpenObligationsCount },
    { count: atRiskContractsCount },
    { data: workflowSettings },
    { data: pinnedSavedViews },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending_review"),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    admin
      .from("contracts")
      .select(CONTRACT_LIST_ROW_COLUMNS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("contracts")
      .select("id, title, counterparty")
      .eq("organization_id", orgId)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("extracted_fields")
      .select(
        "id, field_name, field_value, contracts!inner(id, title, organization_id)"
      )
      .eq("contracts.organization_id", orgId)
      .eq("status", "approved")
      .in("field_name", ["notice_window", "renewal_date", "end_date"])
      .not("field_value", "is", null),
    admin
      .from("extracted_fields")
      .select("id, contracts!inner(organization_id)", { count: "exact", head: true })
      .eq("contracts.organization_id", orgId),
    admin
      .from("extracted_fields")
      .select("id, contracts!inner(organization_id)", { count: "exact", head: true })
      .eq("contracts.organization_id", orgId)
      .eq("status", "approved")
      .in("field_name", [
        "end_date",
        "renewal_date",
        "notice_window",
        "effective_date",
        "start_date",
      ]),
    getContractsMissingCriticalFields(admin, orgId),
    getOrgUsageStats(admin, orgId),
    enforcePlan ? orgHasActivePlan(admin, orgId) : Promise.resolve(true),
    admin
      .from("contract_tasks")
      .select("id, title, status, priority, due_date, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("assignee_id", user.id)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    admin
      .from("contract_obligations")
      .select("id, title, status, due_date, obligation_type, contracts!inner(id, title, organization_id)")
      .eq("organization_id", orgId)
      .eq("owner_id", user.id)
      .in("status", ["open", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("health_status", "at_risk"),
    admin
      .from("organization_workflow_settings")
      .select("dashboard_tracking_enabled, dashboard_pins_json")
      .eq("organization_id", orgId)
      .maybeSingle(),
    admin
      .from("saved_views")
      .select("id, name, view_type, query_json, pinned")
      .eq("organization_id", orgId)
      .eq("pinned", true)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const recentContracts = await attachOwnerProfiles(admin, recentContractsData ?? []);
  const pendingContracts = pendingContractsData ?? [];
  const dateFields = (dateFieldsData ?? []) as unknown as DashboardDeadlineField[];

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

  const upcomingDeadlines = upcomingActions.filter(
    (a) => a.daysUntil <= 30
  ).length;
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
  const commandSavedViews = (pinnedSavedViews ?? []) as Array<{
    id: string;
    name: string;
    view_type: string;
    query_json: Record<string, unknown> | null;
    pinned: boolean;
  }>;
  const commandViewLinks = commandSavedViews.map((view) => {
    const query = new URLSearchParams();
    const q = view.query_json ?? {};
    for (const [k, v] of Object.entries(q)) {
      if (v == null) continue;
      query.set(k, String(v));
    }
    const base =
      view.view_type === "tasks"
        ? "/contracts/tasks"
        : view.view_type === "obligations"
          ? "/contracts/obligations"
          : view.view_type === "renewals"
            ? "/contracts/renewals"
            : "/contracts";
    return {
      id: view.id,
      name: view.name,
      href: query.toString() ? `${base}?${query.toString()}` : base,
      viewType: view.view_type,
    };
  });

  const showPlanBanner = enforcePlan && !hasActivePlan;

  const showOnboarding = !profileRow?.onboarding_completed_at;
  const showPersonaPresets = isFeatureEnabled("v3PersonaDashboards");
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

  const onboardingStats: OnboardingActivationStats = {
    contractCount: totalContracts ?? 0,
    hasExtractions: (extractedFieldsCount ?? 0) > 0,
    approvedOperationalDates: approvedOperationalDatesCount ?? 0,
  };
  if (workflowSettings?.dashboard_tracking_enabled !== false) {
    await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: null,
      user_id: user.id,
      action: "dashboard.viewed",
      details: { view },
    });
  }

  return (
    <div className="space-y-7 md:space-y-8">
      {showOnboarding && <OnboardingBanner stats={onboardingStats} />}
      {showPlanBanner && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed text-amber-950">
            <span className="font-semibold">Subscription required</span> to create or
            edit contracts.
          </p>
          <Link href="/settings/billing" className="ui-btn-secondary shrink-0 px-4 py-2 text-[13px]">
            Billing
          </Link>
        </div>
      )}

      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Mission control</p>
          <h1 className="ui-display-title mt-2">Dashboard</h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-zinc-500 md:text-[15px]">
            Prioritized queues for what needs action now, what is coming next, and what is at risk.
          </p>
        </div>
        <div className="ui-page-actions">
          <div className="mr-1 hidden sm:flex">
            <div className="ui-segmented">
              <Link
                href="/dashboard?view=personal"
                className={`ui-segmented-item ${
                  view === "personal" ? "ui-segmented-item-active" : ""
                }`}
              >
                Personal
              </Link>
              <Link
                href="/dashboard?view=team"
                className={`ui-segmented-item ${
                  view === "team" ? "ui-segmented-item-active" : ""
                }`}
              >
                Team
              </Link>
              <Link
                href="/dashboard?view=portfolio"
                className={`ui-segmented-item ${
                  view === "portfolio" ? "ui-segmented-item-active" : ""
                }`}
              >
                Portfolio
              </Link>
            </div>
          </div>
          {showPersonaPresets && (
            <Link href="/dashboard/persona" className="ui-btn-secondary h-11 px-5">
              Persona views
            </Link>
          )}
          <Link href="/contracts/new" className="ui-btn-primary h-11 px-6">
            Upload contract
          </Link>
        </div>
      </header>

      {showPersonaPresets && (
        <section className="ui-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="ui-label-caps">Persona presets</p>
              <p className="mt-1 text-xs text-zinc-500">Launch role-specific command views in one click.</p>
            </div>
            <Link href="/dashboard/persona" className="ui-link text-xs">
              Open full persona dashboard
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/persona?persona=ops" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
              Ops daily
            </Link>
            <Link href="/dashboard/persona?persona=legal" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
              Legal approvals
            </Link>
            <Link href="/dashboard/persona?persona=finance" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
              Finance renewals
            </Link>
            <Link href="/dashboard/persona?persona=manager" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
              Manager weekly
            </Link>
          </div>
        </section>
      )}

      <StatsCards
        totalContracts={totalContracts ?? 0}
        pendingReview={pendingReview ?? 0}
        upcomingDeadlines={upcomingDeadlines}
        activeContracts={activeContracts ?? 0}
        missingCriticalCount={missingCritical.length}
      />
      <section className="ui-card p-5">
        <p className="ui-label-caps">Why these queues are surfaced</p>
        <ul className="mt-2 space-y-1 text-xs text-zinc-600">
          <li>Now: urgent assigned work, overdue actions, and review bottlenecks.</li>
          <li>Next: date-driven actions due soon from approved contract fields.</li>
          <li>Risk: at-risk contracts, pending approvals, and missing critical fields.</li>
        </ul>
      </section>
      <section className="ui-card p-5">
        <p className="ui-label-caps">Quick filters</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Link href={`/dashboard?view=${view}`} className={`rounded-md border px-2 py-1 ${quickFilter === "all" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600"}`}>
            All
          </Link>
          <Link href={`/dashboard?view=${view}&qf=approvals`} className={`rounded-md border px-2 py-1 ${quickFilter === "approvals" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600"}`}>
            Approvals
          </Link>
          <Link href={`/dashboard?view=${view}&qf=deadlines`} className={`rounded-md border px-2 py-1 ${quickFilter === "deadlines" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600"}`}>
            Deadlines
          </Link>
          <Link href={`/dashboard?view=${view}&qf=data_gaps`} className={`rounded-md border px-2 py-1 ${quickFilter === "data_gaps" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600"}`}>
            Data gaps
          </Link>
        </div>
      </section>
      <section className="ui-card p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="ui-label-caps">Pinned command views</p>
          <Link href="/contracts/tasks" className="ui-link text-xs">
            Manage saved views
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {commandViewLinks.length === 0 ? (
            <p className="text-xs text-zinc-500">No pinned saved views yet. Pin from tasks/obligations/renewals.</p>
          ) : (
            commandViewLinks.map((row) => (
              <Link key={row.id} href={row.href} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                <p className="font-medium text-zinc-900">{row.name}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {row.viewType} view · Why: recurring decision lane pinned for command center.
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
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
                      <Link href={`/contracts/${c.id}`} className="block rounded-lg border border-zinc-200/80 px-3 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50 md:text-sm">
                        <p className="truncate font-semibold text-zinc-900">{c.title}</p>
                        <p className="text-[12px] text-zinc-500">
                          {c.counterparty || "No counterparty"}
                        </p>
                        <p className="text-[11px] text-zinc-400">Why: pending review requires triage ownership.</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-zinc-600">
                <p>
                  Open tasks: <span className="font-semibold text-zinc-900">{teamOpenTasksCount ?? 0}</span>
                </p>
                <p>
                  Open obligations:{" "}
                  <span className="font-semibold text-zinc-900">{teamOpenObligationsCount ?? 0}</span>
                </p>
                <p>
                  At-risk contracts:{" "}
                  <span className="font-semibold text-zinc-900">{atRiskContractsCount ?? 0}</span>
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
                Portfolio mode emphasizes global pipeline and risk rather than individual ownership.
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
            <Link href="/contracts/exceptions" className="block rounded-lg border border-zinc-200/80 px-3 py-2 text-sm hover:bg-zinc-50">
              <span className="font-semibold text-zinc-900">Exceptions</span>
              <p className="text-[12px] text-zinc-500">Review stale records and workflow gaps.</p>
              <p className="text-[11px] text-zinc-400">Why: unresolved exceptions hide execution risk.</p>
            </Link>
            <Link href="/contracts/approvals" className="block rounded-lg border border-zinc-200/80 px-3 py-2 text-sm hover:bg-zinc-50">
              <span className="font-semibold text-zinc-900">Pending approvals</span>
              <p className="text-[12px] text-zinc-500">Resolve queued approvals and blockers.</p>
              <p className="text-[11px] text-zinc-400">Why: stalled approvals block downstream actions.</p>
            </Link>
            <div className="rounded-lg border border-zinc-200/80 px-3 py-2 text-sm">
              <span className="font-semibold text-zinc-900">
                {filteredRiskContracts.length} contracts missing key dates
              </span>
              <p className="text-[12px] text-zinc-500">
                End/renewal/notice fields still need approved values.
              </p>
              <p className="text-[11px] text-zinc-400">Why: missing dates weaken reminder and renewal orchestration.</p>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="ui-section-title text-base">Recent contracts</h2>
            <p className="mt-1 text-[12px] text-zinc-500 md:text-[13px]">Latest activity in your workspace</p>
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
    </div>
  );
}
