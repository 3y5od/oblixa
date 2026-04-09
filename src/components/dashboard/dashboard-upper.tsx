import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { StatsCards } from "@/components/dashboard/stats-cards";
import {
  OnboardingBanner,
  type OnboardingActivationStats,
} from "@/components/dashboard/onboarding-banner";
import { isPlanEnforcementEnabled } from "@/lib/plan";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getDashboardDateFieldsCached,
  getDashboardMissingCriticalCached,
  getDashboardOrgMetricsCached,
  getDashboardWorkflowSettingsCached,
  getOrgHasActivePlanCached,
  getPinnedSavedViewsCached,
  getProfileOnboardingCached,
} from "@/lib/dashboard-data";
import { createAdminClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";

type DashboardDeadlineField = {
  id: string;
  field_name: string;
  field_value: string | null;
  contracts: { id: string; title: string; organization_id: string };
};

export async function DashboardUpper(props: {
  orgId: string;
  userId: string;
  role: WorkspaceRole;
  view: "personal" | "team" | "portfolio";
  quickFilter: "all" | "approvals" | "deadlines" | "data_gaps";
}) {
  const { orgId, userId, role, view, quickFilter } = props;
  const enforcePlan = isPlanEnforcementEnabled();

  const [
    profileRow,
    metrics,
    dateFieldsData,
    missingCritical,
    workflowSettings,
    pinnedSavedViews,
    hasActivePlan,
  ] = await Promise.all([
    getProfileOnboardingCached(userId),
    getDashboardOrgMetricsCached(orgId),
    getDashboardDateFieldsCached(orgId),
    getDashboardMissingCriticalCached(orgId),
    getDashboardWorkflowSettingsCached(orgId),
    getPinnedSavedViewsCached(orgId),
    enforcePlan ? getOrgHasActivePlanCached(orgId) : Promise.resolve(true),
  ]);

  const admin = await createAdminClient();
  if (workflowSettings?.dashboard_tracking_enabled !== false) {
    await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: null,
      user_id: userId,
      action: "dashboard.viewed",
      details: { view },
    });
  }

  const dateFields = dateFieldsData as unknown as DashboardDeadlineField[];
  const today = new Date();
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

  const commandSavedViews = pinnedSavedViews as Array<{
    id: string;
    name: string;
    view_type: string;
    query_json: Record<string, unknown> | null;
    pinned: boolean;
  }>;
  const commandViewLinks = commandSavedViews.map((v) => {
    const query = new URLSearchParams();
    const q = v.query_json ?? {};
    for (const [k, val] of Object.entries(q)) {
      if (val == null) continue;
      query.set(k, String(val));
    }
    const base =
      v.view_type === "tasks"
        ? "/contracts/tasks"
        : v.view_type === "obligations"
          ? "/contracts/obligations"
          : v.view_type === "renewals"
            ? "/contracts/renewals"
            : "/contracts";
    return {
      id: v.id,
      name: v.name,
      href: query.toString() ? `${base}?${query.toString()}` : base,
      viewType: v.view_type,
    };
  });

  const showPlanBanner = enforcePlan && !hasActivePlan;
  const showOnboarding = !profileRow?.onboarding_completed_at;
  const showPersonaPresets = isFeatureEnabled("v3PersonaDashboards");
  const onboardingStats: OnboardingActivationStats = {
    contractCount: metrics.totalContracts,
    hasExtractions: metrics.extractedFieldsTotal > 0,
    approvedOperationalDates: metrics.approvedOperationalDateFields,
  };

  const roleCommandCenterCards: Record<
    string,
    Array<{ title: string; href: string; why: string }>
  > = {
    ops_manager: [
      {
        title: "Open exceptions",
        href: "/contracts/exceptions",
        why: "Exception backlog needs owner and due context.",
      },
      {
        title: "Workflow backlog",
        href: "/work",
        why: "Generated work that is blocked or overdue needs triage.",
      },
      {
        title: "Automation failures",
        href: "/settings/health",
        why: "Failed deliveries and sync errors impact execution trust.",
      },
    ],
    legal_reviewer: [
      {
        title: "Pending approvals",
        href: "/contracts/approvals",
        why: "Legal decisions are bottlenecks for downstream work.",
      },
      {
        title: "Policy mismatches",
        href: "/contracts/exceptions",
        why: "Policy exceptions should be resolved explicitly.",
      },
      {
        title: "Requested legal evidence",
        href: "/work",
        why: "Evidence gates block obligation completion.",
      },
    ],
    finance_reviewer: [
      {
        title: "Renewals with impact",
        href: "/contracts/renewals",
        why: "Commercial outcomes require finance recommendation.",
      },
      {
        title: "Approval bottlenecks",
        href: "/contracts/approvals",
        why: "SLA breaches delay revenue decisions.",
      },
      {
        title: "Billing checkpoint exceptions",
        href: "/contracts/exceptions",
        why: "Data quality and missing owners add risk.",
      },
    ],
    manager: [
      {
        title: "Team capacity",
        href: "/work",
        why: "Workload and blockers should be visible without manual aggregation.",
      },
      {
        title: "SLA adherence",
        href: "/contracts/approvals",
        why: "Approval cycle delays surface governance risk.",
      },
      {
        title: "Risk summary",
        href: "/contracts/reports",
        why: "Trends should be reviewed in report packs.",
      },
    ],
    admin: [
      {
        title: "Execution health",
        href: "/contracts/reports",
        why: "Portfolio health should be monitored weekly.",
      },
      {
        title: "Exceptions and escalations",
        href: "/contracts/exceptions",
        why: "Critical issues require explicit ownership.",
      },
      {
        title: "Maintenance campaigns",
        href: "/contracts/maintenance",
        why: "Backfill and remediation should be controlled.",
      },
    ],
    editor: [
      {
        title: "Assigned work",
        href: "/work",
        why: "Focus on due tasks, approvals, and obligations.",
      },
      {
        title: "Review queue",
        href: "/contracts/review",
        why: "Pending review items block downstream execution.",
      },
      {
        title: "Exception ledger",
        href: "/contracts/exceptions",
        why: "Resolve blockers to keep workflows moving.",
      },
    ],
    viewer: [
      {
        title: "Portfolio snapshot",
        href: "/contracts/reports",
        why: "Read-only visibility into workload and risk.",
      },
      {
        title: "Upcoming deadlines",
        href: "/work",
        why: "Track upcoming obligations and checkpoints.",
      },
      {
        title: "Command center views",
        href: "/dashboard/persona",
        why: "Role views show what changed recently.",
      },
    ],
  };
  const commandCenterForRole =
    roleCommandCenterCards[role] ?? roleCommandCenterCards.viewer;

  return (
    <>
      {showOnboarding && <OnboardingBanner stats={onboardingStats} />}
      {showPlanBanner && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed text-amber-950">
            <span className="font-semibold">Subscription required</span> to create
            or edit contracts.
          </p>
          <Link
            href="/settings/billing"
            className="ui-btn-secondary shrink-0 px-4 py-2 text-[13px]"
          >
            Billing
          </Link>
        </div>
      )}

      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Mission control</p>
          <h1 className="ui-display-title mt-2">Dashboard</h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-zinc-500 md:text-[15px]">
            Prioritized queues for what needs action now, what is coming next, and
            what is at risk.
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

      <section className="ui-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-label-caps">Role command center</p>
            <p className="mt-1 text-xs text-zinc-500">
              Prioritized lanes for the{" "}
              <span className="font-semibold text-zinc-700">
                {role.replace("_", " ")}
              </span>{" "}
              role.
            </p>
          </div>
          <Link href="/dashboard/persona" className="ui-link text-xs">
            Open persona dashboard
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {commandCenterForRole.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              <p className="font-medium text-zinc-900">{card.title}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{card.why}</p>
            </Link>
          ))}
        </div>
      </section>

      {showPersonaPresets && (
        <section className="ui-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="ui-label-caps">Persona presets</p>
              <p className="mt-1 text-xs text-zinc-500">
                Launch role-specific command views in one click.
              </p>
            </div>
            <Link href="/dashboard/persona" className="ui-link text-xs">
              Open full persona dashboard
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/dashboard/persona?persona=ops"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Ops daily
            </Link>
            <Link
              href="/dashboard/persona?persona=legal"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Legal approvals
            </Link>
            <Link
              href="/dashboard/persona?persona=finance"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Finance renewals
            </Link>
            <Link
              href="/dashboard/persona?persona=manager"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Manager weekly
            </Link>
          </div>
        </section>
      )}

      <StatsCards
        totalContracts={metrics.totalContracts}
        pendingReview={metrics.pendingReview}
        upcomingDeadlines={upcomingDeadlines}
        activeContracts={metrics.activeContracts}
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
          <Link
            href={`/dashboard?view=${view}`}
            className={`rounded-md border px-2 py-1 ${
              quickFilter === "all"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600"
            }`}
          >
            All
          </Link>
          <Link
            href={`/dashboard?view=${view}&qf=approvals`}
            className={`rounded-md border px-2 py-1 ${
              quickFilter === "approvals"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600"
            }`}
          >
            Approvals
          </Link>
          <Link
            href={`/dashboard?view=${view}&qf=deadlines`}
            className={`rounded-md border px-2 py-1 ${
              quickFilter === "deadlines"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600"
            }`}
          >
            Deadlines
          </Link>
          <Link
            href={`/dashboard?view=${view}&qf=data_gaps`}
            className={`rounded-md border px-2 py-1 ${
              quickFilter === "data_gaps"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600"
            }`}
          >
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
            <p className="text-xs text-zinc-500">
              No pinned saved views yet. Pin from tasks/obligations/renewals.
            </p>
          ) : (
            commandViewLinks.map((row) => (
              <Link
                key={row.id}
                href={row.href}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              >
                <p className="font-medium text-zinc-900">{row.name}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {row.viewType} view · Why: recurring decision lane pinned for command
                  center.
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}
