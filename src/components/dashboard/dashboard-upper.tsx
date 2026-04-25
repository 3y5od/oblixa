/**
 * product-surface policy §8.1–§8.2 (Core home): supports “what needs action now / due soon” via stats + command
 * shortcuts, onboarding, deadlines lane, and persona-aware command tiles. §8.3 items (assurance scorecards,
 * health graph, etc.) stay in `dashboard/page.tsx` and are mode-gated for Core.
 */
import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  Bookmark,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FolderClock,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { DashboardQuickFilterCard } from "@/components/dashboard/dashboard-quick-filter-card";
import { DashboardPersonaPresets } from "@/components/dashboard/dashboard-persona-presets";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
import {
  OnboardingBanner,
  type OnboardingActivationStats,
} from "@/components/dashboard/onboarding-banner";
import { V9_DUE_SOON_DAYS } from "@/lib/v9-business-dates";
import { isPlanEnforcementEnabled } from "@/lib/plan";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getDashboardAdminClientCached,
  getDashboardDateFieldsCached,
  getDashboardMissingCriticalCached,
  getDashboardOrgMetricsCached,
  getDashboardOperationalSignalsCached,
  getDashboardWorkflowSettingsCached,
  getOrgHasActivePlanCached,
  getPinnedSavedViewsCached,
  getProfileOnboardingCached,
} from "@/lib/dashboard-data";
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
import { buildContractsListHref } from "@/lib/contracts-search-url";

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
  /** Core home hides duplicate persona chrome (product-surface policy §8.3). */
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
    operationalSignals,
  ] = await Promise.all([
    getProfileOnboardingCached(userId),
    getDashboardOrgMetricsCached(orgId),
    getDashboardDateFieldsCached(orgId),
    getDashboardMissingCriticalCached(orgId),
    getDashboardWorkflowSettingsCached(orgId),
    getPinnedSavedViewsCached(orgId),
    enforcePlan ? getOrgHasActivePlanCached(orgId) : Promise.resolve(true),
    getDashboardOperationalSignalsCached(orgId, userId),
  ]);

  const admin = await getDashboardAdminClientCached();
  const [v6OrgSettings, recentImportJobsRes, failedExtractionRes] = await Promise.all([
    getV6OrgSettingsJson(admin, orgId),
    admin
      .from("contract_import_jobs")
      .select("id, status, error_rows, failure_reason, created_at, inserted_rows, total_rows")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("contract_extraction_jobs")
      .select("contract_id, last_error, completed_at")
      .eq("organization_id", orgId)
      .eq("status", "failed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
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
      const href =
        base === "/contracts"
          ? buildContractsListHref(
              Object.fromEntries(query.entries()) as Record<string, string>
            )
          : query.toString()
            ? `${base}?${query.toString()}`
            : base;
      return {
        id: v.id,
        name: v.name,
        href,
        viewType: v.view_type,
      };
    })
    .filter((row) => isHrefEligible(row.href));

  const showPlanBanner = enforcePlan && !hasActivePlan;
  const showOnboarding =
    !profileRow?.onboarding_completed_at && !calibrationBlocking;
  const showPersonaPresets =
    isFeatureEnabled("v3PersonaDashboards") && !isCoreHome;
  const setupChecklist = onboardingCalibration?.last_recommendation?.recommended_setup_checklist;
  const importJobs = (recentImportJobsRes.data ?? []) as Array<{
    id: string;
    status: string;
    error_rows: number | null;
    failure_reason: string | null;
    inserted_rows?: number | null;
    total_rows?: number | null;
  }>;
  const latestImportJob = importJobs[0] ?? null;
  const latestRecoverableImport =
    importJobs.find((job) => job.status === "failed" || (job.error_rows ?? 0) > 0) ?? null;
  const latestFailedExtraction = failedExtractionRes.data ?? null;
  const importJobProcessing = latestImportJob?.status === "processing";
  const importJobCompletedInserts =
    latestImportJob?.status === "completed" && (latestImportJob.inserted_rows ?? 0) > 0;
  const onboardingStats: OnboardingActivationStats = {
    setupConfigured: Boolean(onboardingCalibration || setupChecklist?.length),
    contractCount: metrics.totalContracts,
    hasExtractions: metrics.extractedFieldsTotal > 0,
    approvedOperationalDates: metrics.approvedOperationalDateFields,
    pendingReviewCount: metrics.pendingReview,
    ownerAssignedContracts: operationalSignals.ownerAssignedContracts,
    visibleWorkItems: operationalSignals.visibleWorkItems,
    renewalAttention: operationalSignals.renewalAttention,
    dashboardReady:
      metrics.totalContracts > 0 &&
      (metrics.pendingReview > 0 ||
        operationalSignals.visibleWorkItems > 0 ||
        operationalSignals.renewalAttention > 0 ||
        metrics.approvedOperationalDateFields > 0),
    importJobProcessing,
    importJobCompletedInserts,
    recoverableImportIssue:
      latestRecoverableImport?.failure_reason ||
      ((latestRecoverableImport?.error_rows ?? 0) > 0
        ? `${latestRecoverableImport?.error_rows ?? 0} imported row${(latestRecoverableImport?.error_rows ?? 0) === 1 ? "" : "s"} still need correction or retry.`
        : null),
    failedExtractionIssue: latestFailedExtraction?.last_error ?? null,
    failedExtractionContractId: latestFailedExtraction?.contract_id ?? null,
  };
  const focusCards = [
    {
      id: "assigned-work",
      title: "Assigned work",
      href: "/work?lens=assigned",
      why: "Tasks, approvals, and obligations already routed to you.",
      count: operationalSignals.assignedWork,
      icon: ClipboardList,
      tone: operationalSignals.assignedWork > 0 ? ("attention" as const) : ("healthy" as const),
      actionLabel: "Open assigned work",
      priority: 4,
    },
    {
      id: "due-soon",
      title: "Due soon",
      href: "/work?lens=due_soon",
      why: `Items in the next ${V9_DUE_SOON_DAYS} days that need attention before they slip.`,
      count: operationalSignals.dueSoonAssignedWork,
      icon: CalendarClock,
      tone:
        operationalSignals.dueSoonAssignedWork > 0 ? ("risk" as const) : ("healthy" as const),
      actionLabel: "Open due-soon queue",
      priority: 1,
    },
    {
      id: "approvals",
      title: "Pending approvals",
      href: "/contracts/approvals?status=pending",
      why: "Sign-off bottlenecks that block reminders, work, or renewal decisions.",
      count: operationalSignals.pendingApprovals,
      icon: BadgeCheck,
      tone: operationalSignals.pendingApprovals > 0 ? ("attention" as const) : ("healthy" as const),
      actionLabel: "Review approvals",
      priority: 3,
    },
    {
      id: "renewals",
      title: "Renewals needing attention",
      href: "/contracts/renewals?horizon=renewal_90",
      why: "Contracts with renewal dates inside the active window.",
      count: operationalSignals.renewalAttention,
      icon: FolderClock,
      tone: operationalSignals.renewalAttention > 0 ? ("attention" as const) : ("healthy" as const),
      actionLabel: "Open renewals",
      priority: 5,
    },
    {
      id: "exceptions",
      title: "Open exceptions",
      href: "/contracts/exceptions?status=open",
      why: "Risk and blocker records that still need an owner or resolution path.",
      count: operationalSignals.openExceptions,
      icon: AlertTriangle,
      tone: operationalSignals.openExceptions > 0 ? ("risk" as const) : ("healthy" as const),
      actionLabel: "Open exceptions",
      priority: 2,
    },
    {
      id: "evidence",
      title: "Evidence gaps",
      href: "/contracts?evidence=outstanding",
      why: "Outstanding evidence still holding back obligated work.",
      count: operationalSignals.outstandingEvidence,
      icon: ShieldAlert,
      tone:
        operationalSignals.outstandingEvidence > 0 ? ("attention" as const) : ("healthy" as const),
      actionLabel: "Review evidence",
      priority: 6,
    },
    {
      id: "review",
      title: "Review backlog",
      href: "/contracts/review",
      why: "Field review still pending before the workspace can trust extracted values.",
      count: metrics.pendingReview,
      icon: ClipboardCheck,
      tone: metrics.pendingReview > 0 ? ("attention" as const) : ("healthy" as const),
      actionLabel: "Open review queue",
      priority: 3,
    },
    {
      id: "recent",
      title: "Recent changes",
      href: "/contracts?sort=activity",
      why: "Freshly touched contracts and workflow changes from the last 7 days.",
      count: operationalSignals.recentChanges,
      icon: Scale,
      tone: operationalSignals.recentChanges > 0 ? ("neutral" as const) : ("healthy" as const),
      actionLabel: "Open recent activity",
      priority: 7,
    },
  ].filter((card) => isHrefEligible(card.href));
  const orderedFocusCards = [...focusCards].sort((a, b) => {
    const activeDelta = Number(b.count > 0) - Number(a.count > 0);
    if (activeDelta !== 0) return activeDelta;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });
  const actionableFocusCards = orderedFocusCards.filter((card) => card.count > 0);
  const fallbackFocusCards = orderedFocusCards.filter((card) => card.count === 0);
  const displayFocusCards = [...actionableFocusCards, ...fallbackFocusCards];

  const roleCommandCenterCards: Record<
    string,
    Array<{ title: string; href: string; why: string }>
  > = {
    ops_manager: [
      {
        title: "Open exceptions",
        href: "/contracts/exceptions?status=open&severity=critical",
        why: "Exception backlog needs owner and due context.",
      },
      {
        title: "Workflow backlog",
        href: "/work?lens=overdue",
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
        href: "/contracts/approvals?status=pending",
        why: "Legal approvals are bottlenecks for downstream work.",
      },
      {
        title: "Policy mismatches",
        href: "/contracts/exceptions?status=open",
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
        href: "/contracts/approvals?status=pending",
        why: "SLA breaches delay revenue operations.",
      },
      {
        title: "Billing checkpoint exceptions",
        href: "/contracts/exceptions?status=open",
        why: "Data quality and missing owners add risk.",
      },
    ],
    manager: [
      {
        title: "Team capacity",
        href: "/contracts/tasks?status=open",
        why: "Workload and blockers should be visible without manual aggregation.",
      },
      {
        title: "SLA adherence",
        href: "/contracts/approvals?status=pending",
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
        href: "/contracts/exceptions?status=open&severity=critical",
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
        href: "/work?lens=assigned",
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
        href: "/contracts/obligations?status=open",
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
  const summaryHighlights = [
    { label: "Assigned work", value: operationalSignals.assignedWork },
    { label: "Pending review", value: metrics.pendingReview },
    { label: "Renewal attention", value: operationalSignals.renewalAttention },
    { label: "Visible work", value: operationalSignals.visibleWorkItems },
  ];

  return (
    <>
      {showOnboarding && (
        <OnboardingBanner
          stats={onboardingStats}
          setupChecklist={setupChecklist}
        />
      )}
      {showPlanBanner && (
        <div className="ui-alert-warning flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed">
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
        <div className="space-y-4">
          <p className="ui-eyebrow">Mission control</p>
          <h1 className="ui-display-title mt-2 sm:text-[3.2rem]">Dashboard</h1>
          <p className="ui-page-lead">
            Critical queues, risk signals, next actions, and saved operating views for the current workspace.
          </p>
          {onboardingCalibration?.last_recommendation &&
          onboardingCalibration.answers_optional?.org_role &&
          onboardingCalibration.answers_optional.org_role !== "unspecified" ? (
            <p className="ui-support-copy max-w-xl">{dashboardOrgRoleCalibrationNudge}</p>
          ) : null}
          <div className="flex flex-wrap gap-2.5 pt-1">
            {summaryHighlights.map((item) => (
              <div
                key={item.label}
                className="ui-metric-chip grid min-w-[9rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
              >
                <span className="ui-meta leading-none">{item.label}</span>
                <span className="text-base font-semibold leading-none tabular-nums text-[var(--text-primary)]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="ui-page-actions">
          <div className="ui-toolbar-strong mr-1 hidden gap-3 sm:flex">
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
              Persona studio
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

      <section className="ui-page-shell space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-eyebrow">Operations</p>
            <h2 className="ui-page-title mt-2 text-[1.8rem]">What needs action now</h2>
            <p className="ui-section-lead mt-2">
              Deep links into the queues and records that most directly affect execution trust.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {displayFocusCards.map((card, index) => (
            <OperationalSurfaceLinkCard
              key={card.id}
              href={card.href}
              eyebrow="Focus"
              title={card.title}
              hint={card.why}
              icon={card.icon}
              tone={card.tone}
              chips={[{ label: "Count", value: String(card.count) }]}
              actionLabel={card.actionLabel}
              variant={index === 0 ? "hero" : "default"}
              className={index === 0 ? "sm:col-span-2 xl:col-span-3" : "xl:col-span-2"}
            />
          ))}
        </div>
      </section>

      <section className="ui-page-shell space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-eyebrow">Shortcuts</p>
            <h2 className="ui-section-title mt-2 text-[1.25rem]">Action lanes</h2>
            <p className="ui-section-lead mt-2">
              Role defaults for {role.replace("_", " ")}.
            </p>
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

      {showPersonaPresets ? <DashboardPersonaPresets /> : null}

      <DashboardQuickFilterCard view={view} quickFilter={quickFilter} />
      <section className="ui-page-shell space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-eyebrow">Saved</p>
            <h2 className="ui-section-title mt-2 text-[1.25rem]">Pinned command views</h2>
            <p className="ui-section-lead mt-2">
              Keep recurring queue configurations one click away.
            </p>
          </div>
          <Link href={manageSavedViewsHref} className="ui-link text-xs">
            Manage saved views
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {commandViewLinks.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)]">
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
