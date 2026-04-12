/**
 * docs/refinement.md §8.1–§8.2 (Core home): supports “what needs action now / due soon” via stats + command
 * shortcuts, onboarding, deadlines lane, and persona-aware command tiles. §8.3 items (assurance scorecards,
 * health graph, etc.) stay in `dashboard/page.tsx` and are mode-gated for Core.
 */
import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { Bookmark, ClipboardList, Scale, ShieldAlert, UserCircle, Wallet } from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
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
import {
  isOnboardingBlockingForAdmin,
  parseOnboardingCalibration,
} from "@/lib/onboarding/calibration-types";
import { dashboardOrgRoleCalibrationNudge } from "@/lib/onboarding/calibration-copy";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import type { WorkspaceRole } from "@/lib/navigation";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { isHrefEligibleForProductSurface } from "@/lib/product-surface/href-eligibility";

const COMMAND_LANE_ICONS = [ClipboardList, Scale, ShieldAlert] as const;

function shortcutActionLabel(href: string): string {
  if (href.includes("/approvals")) return "View approvals";
  if (href.includes("/exceptions")) return "View exceptions";
  if (href.includes("/renewals")) return "View renewals";
  if (href.includes("/reports")) return "Open reports";
  if (href.includes("/review")) return "Open review queue";
  if (href.includes("/maintenance")) return "Open maintenance";
  if (href.startsWith("/work")) return "View work queue";
  if (href.includes("/health")) return "Open health";
  if (href.includes("/persona")) return "Open persona";
  return "Open destination";
}

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
  /** Core home hides duplicate persona chrome (docs/refinement.md §8.3). */
  workspaceProductMode?: WorkspaceProductMode;
  productSurfaceContext: ProductSurfaceContext;
}) {
  const { orgId, userId, role, view, quickFilter, workspaceProductMode, productSurfaceContext } = props;
  const isCoreHome = workspaceProductMode === "core";
  const isHrefEligible = (href: string) =>
    isHrefEligibleForProductSurface(productSurfaceContext, href);
  /** §4.4 — subscription gate for create/edit only; never used for nav, mode, or landing IA. */
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
  const v6OrgSettings = await getV6OrgSettingsJson(admin, orgId);
  const onboardingCalibration = parseOnboardingCalibration(v6OrgSettings.onboarding_calibration);
  const calibrationBlocking = isOnboardingBlockingForAdmin({
    role,
    calibration: onboardingCalibration,
  });
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
  const commandViewLinks = commandSavedViews
    .map((v) => {
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
    })
    .filter((row) => isHrefEligible(row.href));

  const showPlanBanner = enforcePlan && !hasActivePlan;
  const showOnboarding =
    !profileRow?.onboarding_completed_at && !calibrationBlocking;
  const showPersonaPresets =
    isFeatureEnabled("v3PersonaDashboards") && !isCoreHome;
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
        why: "Legal approvals are bottlenecks for downstream work.",
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
        why: "SLA breaches delay revenue operations.",
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
  const visibleCommandCenterCards = commandCenterForRole.filter((card) => {
    if (isCoreHome && card.href.startsWith("/contracts/maintenance")) return false;
    return isHrefEligible(card.href);
  });
  const manageSavedViewsHref = isHrefEligible("/contracts/tasks")
    ? "/contracts/tasks"
    : "/contracts";

  return (
    <>
      {showOnboarding && (
        <OnboardingBanner
          stats={onboardingStats}
          setupChecklist={onboardingCalibration?.last_recommendation?.recommended_setup_checklist}
        />
      )}
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
          <p className="ui-muted-tight mt-2 max-w-xl">Critical queues, risk signals, and next actions.</p>
          {onboardingCalibration?.last_recommendation &&
          onboardingCalibration.answers_optional?.org_role &&
          onboardingCalibration.answers_optional.org_role !== "unspecified" ? (
            <p className="ui-muted-tight mt-2 max-w-xl text-[13px]">{dashboardOrgRoleCalibrationNudge}</p>
          ) : null}
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
          {showPersonaPresets ? (
            <Link href="/dashboard/persona" className="ui-btn-secondary h-11 px-5">
              Persona views
            </Link>
          ) : null}
          <Link href="/contracts/new" className="ui-btn-primary h-11 px-6">
            Upload contract
          </Link>
        </div>
      </header>

      {/* §8.1 — portfolio metrics before deep action lanes */}
      <StatsCards
        totalContracts={metrics.totalContracts}
        pendingReview={metrics.pendingReview}
        upcomingDeadlines={upcomingDeadlines}
        activeContracts={metrics.activeContracts}
        missingCriticalCount={missingCritical.length}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-eyebrow">Shortcuts</p>
            <h2 className="ui-section-title mt-2 text-xl">Action lanes</h2>
            <p className="ui-muted-tight mt-1 text-[12px]">Role defaults for {role.replace("_", " ")}.</p>
          </div>
          {showPersonaPresets ? (
            <Link href="/dashboard/persona" className="ui-link text-xs">
              Persona views
            </Link>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCommandCenterCards.map((card, i) => {
            const Icon = COMMAND_LANE_ICONS[i % COMMAND_LANE_ICONS.length]!;
            return (
              <OperationalSurfaceLinkCard
                key={card.title}
                href={card.href}
                eyebrow="Lane"
                title={card.title}
                hint={card.why}
                icon={Icon}
                tone="neutral"
                actionLabel={shortcutActionLabel(card.href)}
              />
            );
          })}
        </div>
      </section>

      {showPersonaPresets && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="ui-eyebrow">Personas</p>
              <h2 className="ui-section-title mt-2 text-xl">Preset views</h2>
              <p className="ui-muted-tight mt-1 text-[12px]">One-click command layouts.</p>
            </div>
            <Link href="/dashboard/persona" className="ui-link text-xs">
              Full persona dashboard
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OperationalSurfaceLinkCard
              href="/dashboard/persona?persona=ops"
              eyebrow="Ops"
              title="Ops daily"
              icon={ClipboardList}
              tone="neutral"
              actionLabel="Open ops view"
            />
            <OperationalSurfaceLinkCard
              href="/dashboard/persona?persona=legal"
              eyebrow="Legal"
              title="Legal approvals"
              icon={Scale}
              tone="neutral"
              actionLabel="Open legal view"
            />
            <OperationalSurfaceLinkCard
              href="/dashboard/persona?persona=finance"
              eyebrow="Finance"
              title="Finance renewals"
              icon={Wallet}
              tone="neutral"
              actionLabel="Open finance view"
            />
            <OperationalSurfaceLinkCard
              href="/dashboard/persona?persona=manager"
              eyebrow="Manager"
              title="Manager weekly"
              icon={UserCircle}
              tone="neutral"
              actionLabel="Open manager view"
            />
          </div>
        </section>
      )}

      <section className="ui-card p-5">
        <p className="ui-eyebrow">Shortcuts</p>
        <h2 className="ui-section-title mt-1 text-base">Quick filters</h2>
        <div className="ui-filter-row mt-3 text-xs">
          <Link
            href={`/dashboard?view=${view}`}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-3 py-1.5 ${
              quickFilter === "all"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            All
          </Link>
          <Link
            href={`/dashboard?view=${view}&qf=approvals`}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-3 py-1.5 ${
              quickFilter === "approvals"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Approvals
          </Link>
          <Link
            href={`/dashboard?view=${view}&qf=deadlines`}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-3 py-1.5 ${
              quickFilter === "deadlines"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Deadlines
          </Link>
          <Link
            href={`/dashboard?view=${view}&qf=data_gaps`}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-3 py-1.5 ${
              quickFilter === "data_gaps"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Data gaps
          </Link>
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-eyebrow">Saved</p>
            <h2 className="ui-section-title mt-2 text-xl">Pinned command views</h2>
          </div>
          <Link href={manageSavedViewsHref} className="ui-link text-xs">
            Manage saved views
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {commandViewLinks.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No pinned saved views yet. Pin from tasks/obligations/renewals.
            </p>
          ) : (
            commandViewLinks.map((row) => (
              <OperationalSurfaceLinkCard
                key={row.id}
                href={row.href}
                eyebrow="Saved view"
                title={row.name}
                icon={Bookmark}
                tone="neutral"
                chips={[{ label: "Type", value: row.viewType }]}
                actionLabel="Open saved view"
              />
            ))
          )}
        </div>
      </section>
    </>
  );
}
