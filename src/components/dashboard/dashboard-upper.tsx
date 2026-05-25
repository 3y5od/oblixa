/**
 * product-surface policy §8.1–§8.2 (Core home): supports “what needs action now / due soon” via stats + command
 * shortcuts, onboarding, deadlines lane, and persona-aware command tiles. §8.3 items (assurance scorecards,
 * health graph, etc.) stay in `dashboard/page.tsx` and are mode-gated for Core.
 */
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FolderClock,
  History,
  LayoutDashboard,
  ShieldAlert,
  Slash,
  UploadCloud,
  UserX,
} from "lucide-react";
import { DashboardPersonaPresets } from "@/components/dashboard/dashboard-persona-presets";
import { OperationalSurfaceLinkCard } from "@/components/ui/operational-summary-card";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import {
  OnboardingBanner,
  type OnboardingActivationStats,
} from "@/components/dashboard/onboarding-banner";
import { DUE_SOON_DAYS } from "@/lib/business-dates";
import { isPlanEnforcementEnabled } from "@/lib/plan";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getDashboardAdminClientCached,
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
import {
  DASHBOARD_TITLE,
  DASHBOARD_PRIMARY_CTA,
  DASHBOARD_SECONDARY_CTA,
} from "@/lib/dashboard/spec-strings";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import type { WorkspaceRole } from "@/lib/navigation";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { isHrefEligibleForProductSurface } from "@/lib/product-surface/href-eligibility";
import { buildContractsListHref } from "@/lib/contracts-search-url";

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
  const { orgId, userId, role, view, workspaceProductMode, productSurfaceContext } = props;
  const isCoreHome = workspaceProductMode === "core";
  const isHrefEligible = (href: string) =>
    isHrefEligibleForProductSurface(productSurfaceContext, href);
  /** §4.4 — subscription gate for create/edit only; never used for nav, mode, or landing IA. */
  const enforcePlan = isPlanEnforcementEnabled();

  const [
    profileRow,
    metrics,
    workflowSettings,
    pinnedSavedViews,
    hasActivePlan,
    operationalSignals,
  ] = await Promise.all([
    getProfileOnboardingCached(userId),
    getDashboardOrgMetricsCached(orgId),
    getDashboardWorkflowSettingsCached(orgId),
    getPinnedSavedViewsCached(orgId),
    enforcePlan ? getOrgHasActivePlanCached(orgId) : Promise.resolve(true),
    getDashboardOperationalSignalsCached(orgId, userId),
  ]);

  const admin = await getDashboardAdminClientCached();
  const [v6OrgSettings, recentImportJobsRes, failedExtractionRes, orgIdentityRes] = await Promise.all([
    getOrgSettingsJson(admin, orgId),
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
    admin
      .from("organizations")
      .select("name, plan_tier")
      .eq("id", orgId)
      .maybeSingle(),
  ]);
  const orgIdentity = (orgIdentityRes.data as { name?: string; plan_tier?: string } | null) ?? null;
  const workspaceName = orgIdentity?.name?.trim() || "Workspace";
  // planTier is surfaced via the right-rail Account snapshot panel.
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
      actionLabel: "Open work",
      priority: 4,
    },
    {
      // v11 dashboard spec compliance Tier 2.3: title renamed to spec-mandated
      // "Upcoming deadlines" per spec §Dashboard Page Top cards.
      id: "due-soon",
      title: "Upcoming deadlines",
      href: "/work?lens=due_soon",
      why: `Items in the next ${DUE_SOON_DAYS} days that need attention before they slip.`,
      count: operationalSignals.dueSoonAssignedWork,
      icon: CalendarClock,
      tone:
        operationalSignals.dueSoonAssignedWork > 0 ? ("risk" as const) : ("healthy" as const),
      actionLabel: "Open deadlines",
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
      href: "/contracts/renewals?window=90",
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
      actionLabel: "Open",
      priority: 2,
    },
    {
      // v11 dashboard spec compliance Tier 2.3: title renamed to spec-mandated
      // "Evidence requested" per spec §Dashboard Page Top cards.
      id: "evidence",
      title: "Evidence requested",
      href: "/contracts?evidence=outstanding",
      why: "Outstanding evidence still holding back obligated work.",
      count: operationalSignals.outstandingEvidence,
      icon: ShieldAlert,
      tone:
        operationalSignals.outstandingEvidence > 0 ? ("attention" as const) : ("healthy" as const),
      actionLabel: "Open evidence",
      priority: 6,
    },
    {
      // v11 dashboard spec compliance Tier 2.3: title renamed to spec-mandated
      // "Needs review" per spec §Dashboard Page Top cards.
      id: "review",
      title: "Needs review",
      href: "/contracts/review",
      why: "Field review still pending before the workspace can trust extracted values.",
      count: metrics.pendingReview,
      icon: ClipboardCheck,
      tone: metrics.pendingReview > 0 ? ("attention" as const) : ("healthy" as const),
      actionLabel: "Review fields",
      priority: 3,
    },
    {
      id: "recent",
      title: "Recent changes",
      href: "/contracts?sort=activity",
      why: "Freshly touched contracts and workflow changes from the last 7 days.",
      count: operationalSignals.recentChanges,
      icon: History,
      tone: operationalSignals.recentChanges > 0 ? ("neutral" as const) : ("healthy" as const),
      actionLabel: "See activity",
      priority: 7,
    },
    {
      // v11 dashboard spec compliance Tier 2.3: "Missing owners" spec card
      // added per spec §Dashboard Page Top cards. Count derived from
      // (totalContracts - ownerAssignedContracts) since the data layer
      // surfaces ownerAssignedContracts as a positive counter.
      id: "missing-owners",
      title: "Missing owners",
      href: "/contracts",
      why: "Contracts without an assigned owner cannot route work or reminders.",
      count: Math.max(
        0,
        metrics.totalContracts - operationalSignals.ownerAssignedContracts
      ),
      icon: UserX,
      tone:
        metrics.totalContracts > 0 &&
        metrics.totalContracts - operationalSignals.ownerAssignedContracts > 0
          ? ("attention" as const)
          : ("healthy" as const),
      actionLabel: "Assign owners",
      priority: 5,
    },
    {
      // v11 dashboard spec compliance Tier 2.3 + Tier 20.4: "Blocked work"
      // spec card with a stub count=0 fallback. The data layer currently
      // does NOT surface a dedicated `blockedWork` counter; a real backend
      // query against work_items WHERE status = 'blocked' is the proper fix
      // (Tier 20.3). Per Tier 20.4 ("stub-with-zero fallback — Never omit
      // a card"), the card renders with count 0 + healthy tone until the
      // backend query lands.
      id: "blocked-work",
      title: "Blocked work",
      href: "/work",
      why: "Work items currently blocked on dependencies, approvals, or evidence.",
      count: 0,
      icon: Slash,
      tone: "healthy" as const,
      actionLabel: "Open work",
      priority: 4,
    },
  ].filter((card) => isHrefEligible(card.href));
  const orderedFocusCards = [...focusCards].sort((a, b) => {
    const activeDelta = Number(b.count > 0) - Number(a.count > 0);
    if (activeDelta !== 0) return activeDelta;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });
  // v11 dashboard spec compliance Tier 2.5: spec mandates exactly 6 cards
  // always rendered. We pass all ordered cards through and the render uses
  // slice(0, 6) to bound the visible set. The actionable/fallback split is
  // no longer needed since spec wants 6 cards regardless of count state.
  const displayFocusCards = orderedFocusCards;

  const manageSavedViewsHref = isHrefEligible("/contracts/tasks")
    ? "/contracts/tasks"
    : "/contracts";
  const hasPinnedCommandViews = commandViewLinks.length > 0;

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
            className="ui-btn-secondary shrink-0 px-4 py-2 text-[12.5px]"
          >
            Billing
          </Link>
        </div>
      )}

      <DashboardPageHeader
        icon={<LayoutDashboard className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        // v11 visual pass: eyebrow shows the workspace name when known;
        // suppressed entirely when the workspace has no name. Drops the
        // generic "DASHBOARD" placeholder that read as SaaS-template chrome.
        eyebrow={workspaceName}
        suppressEyebrow={!orgIdentity?.name?.trim()}
        title={DASHBOARD_TITLE}
        monogram={
          orgIdentity?.name?.trim()
            ? workspaceName.slice(0, 2).toUpperCase()
            : undefined
        }
        // v11 visual pass: LIVE pulse dropped. The user is on their own
        // workspace — the indicator adds no information and read as a
        // Vercel-deploy-page tic. Real-time freshness, when it matters,
        // surfaces via the synced-Xm-ago meta line instead.
        metaStrip={(() => {
          const planTier = orgIdentity?.plan_tier?.trim();
          const total = metrics.totalContracts;
          const items: Array<{ label: string; value: string }> = [];
          if (orgIdentity?.name?.trim()) {
            items.push({ label: "Workspace", value: workspaceName });
          }
          if (total > 0) {
            items.push({
              label: "Contracts",
              value: total === 1 ? "1" : String(total),
            });
          }
          if (planTier) {
            items.push({
              label: "Plan",
              value: `${planTier.charAt(0).toUpperCase()}${planTier.slice(1).toLowerCase()}`,
            });
          }
          if (items.length === 0) return null;
          return items.map((item, idx) => (
            <span
              key={item.label}
              className="inline-flex items-baseline gap-1.5"
            >
              {idx > 0 ? (
                <span
                  aria-hidden
                  className="inline-block h-3 w-px self-center bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
                />
              ) : null}
              <dt className="ui-caps-3 text-[var(--text-tertiary)]">
                {item.label}
              </dt>
              <dd className="font-medium tabular-nums text-[var(--text-secondary)]">
                {item.value}
              </dd>
            </span>
          ));
        })()}
        // v11 dashboard spec compliance: status-pill lead removed.
        // Per Tier 1.6 + 1.7, header carries only title + primary/secondary
        // CTAs; spec top cards (Tier 2: Needs review / Open exceptions /
        // Blocked work / etc.) surface these counts as discrete cards.
        lead={null}
        actions={
          <>
            {showPersonaPresets ? (
              <Link
                href="/dashboard/persona"
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              >
                Persona studio
              </Link>
            ) : null}
            {/* v11 release-state pass: state-aware primary CTA. When there
                are contracts pending review, "Review fields" is the
                dominant action (per release-state §Contract Detail's
                state-aware header pattern). "Upload contract" demotes to
                secondary, "Import CSV" to ghost. When the queue is empty,
                the spec-default order returns. */}
            {metrics.pendingReview > 0 ? (
              <>
                <Link
                  href="/contracts/review"
                  className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
                >
                  Review fields
                </Link>
                <Link
                  href="/contracts/new"
                  className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
                >
                  <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  {DASHBOARD_PRIMARY_CTA}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/contracts/new"
                  className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
                >
                  <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  {DASHBOARD_PRIMARY_CTA}
                </Link>
                <Link
                  href="/contracts/intake"
                  prefetch={false}
                  className="ui-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
                >
                  {DASHBOARD_SECONDARY_CTA}
                </Link>
              </>
            )}
          </>
        }
      />
      {/* v11 dashboard spec compliance Tier 1.8: PERSONAL / TEAM / PORTFOLIO
          tab strip removed. Spec §Dashboard Page is singular, not tabbed.
          The `view` prop is preserved for telemetry and existing callers
          but no longer surfaces UI segmentation. */}
      {onboardingCalibration?.last_recommendation &&
      onboardingCalibration.answers_optional?.org_role &&
      onboardingCalibration.answers_optional.org_role !== "unspecified" ? (
        <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)] max-w-xl">
          {dashboardOrgRoleCalibrationNudge}
        </p>
      ) : null}

      {/* v11 dashboard spec compliance: SETUP progress widget removed.
          Setup is the responsibility of /onboarding/calibration per spec
          §Calibration Page. The dashboard should never render an inline
          setup wizard. The OnboardingBanner above still handles the
          first-time guidance when showOnboarding is true. */}

      {/* v11 dashboard spec compliance Tier 3.12: Quick-link chip strip
          (Open exceptions / Approvals / Renewals / Reports / Work queue)
          removed. Redundant with sidebar nav (Renewals + Evidence now
          top-level; sidebar carries all 7 Core nav items). Counts that
          this strip surfaced are now in the spec top cards (Tier 2). */}

      {/* v13 aesthetic pass — major subtraction:
          - Dropped the TODAY'S FOCUS active-risk hero banner. It duplicated
            the KPI grid below it (the 3 ChipCapsules in the banner were the
            same 3 active cards in the grid).
          - Dropped the "Work needing action" section h2 + "Open all work"
            link above the KPI grid. The h2 duplicated the spec's "Work
            Needing Action" main section in dashboard-lower.
          - Compressed the 6 KPI cards into a tighter inline render: no
            corner-ring decoration, no medallion, no footer-link border-t,
            smaller padding. Each card now ~100px tall (was ~200px).
          - Spec §Dashboard Page Top cards mandate of 6 visible surfaces is
            preserved; the visual treatment is just more honest about
            density.
          - sr-only dashboard-status-h heading preserves the spec contract
            for assistive tech. */}
      <h2 id="dashboard-status-h" className="sr-only">
        {(() => {
          const active = displayFocusCards
            .slice(0, 6)
            .filter((c) => c.count > 0);
          if (active.length === 0) return "All clear — nothing needs attention";
          const total = active.reduce((sum, c) => sum + c.count, 0);
          return `${total} ${total === 1 ? "item" : "items"} need attention: ${active
            .map((c) => `${c.count} ${c.title.toLowerCase()}`)
            .join(", ")}`;
        })()}
      </h2>

      <section
        aria-label="Top cards"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {displayFocusCards.slice(0, 6).map((card) => {
          const tone: "neutral" | "success" | "warning" | "danger" =
            card.tone === "risk"
              ? "danger"
              : card.tone === "attention"
                ? "warning"
                : card.tone === "healthy"
                  ? "success"
                  : "neutral";
          const isZero = card.count === 0;
          const ink = isZero
            ? "color-mix(in oklab, var(--success-ink) 55%, var(--text-tertiary))"
            : tone === "danger"
              ? "var(--danger-ink)"
              : tone === "warning"
                ? "var(--warning-ink)"
                : "var(--text-primary)";
          const Icon = card.icon;
          return (
            <Link
              key={card.id}
              href={card.href}
              aria-label={`${card.title}: ${card.count}. ${card.actionLabel}.`}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-[var(--surface-raised)] px-3.5 py-3 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_45%,transparent)]"
              style={{
                borderColor: isZero
                  ? "color-mix(in oklab, var(--success-ink) 14%, var(--border-card))"
                  : tone !== "neutral"
                    ? `color-mix(in oklab, ${ink} 18%, var(--border-card))`
                    : "var(--border-card)",
                background: isZero
                  ? "var(--surface-raised)"
                  : tone !== "neutral"
                    ? `color-mix(in oklab, ${ink} 3%, var(--surface-raised))`
                    : "var(--surface-raised)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.85}
                  aria-hidden
                  style={{ color: ink }}
                />
                <span
                  className="ui-caps-3 truncate text-[var(--text-tertiary)]"
                  style={{ color: isZero ? "var(--text-tertiary)" : ink }}
                >
                  {card.title}
                </span>
              </div>
              <p
                className="text-[1.625rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
                style={{ color: ink }}
              >
                {card.count}
              </p>
              <p
                className="mt-auto inline-flex items-center justify-between gap-1.5 text-[11.5px] font-medium leading-none text-[var(--text-tertiary)]"
              >
                <span className="truncate">{card.actionLabel}</span>
                <ArrowRight
                  className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                  aria-hidden
                  style={{ color: isZero ? "var(--text-tertiary)" : "var(--accent-strong)" }}
                />
              </p>
            </Link>
          );
        })}
      </section>

      {showPersonaPresets ? <DashboardPersonaPresets /> : null}

      {hasPinnedCommandViews ? (
        <section className="ui-page-shell space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <span className="landing-eyebrow-dot" aria-hidden />
                Saved
              </p>
              <h2 className="ui-section-title mt-2 text-[1.25rem]">Pinned command views</h2>
              <p className="ui-section-lead mt-2">
                Keep recurring queue configurations one click away.
              </p>
            </div>
            <Link href={manageSavedViewsHref} className="ui-link inline-flex items-center gap-1 text-xs">
              Manage saved views
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {commandViewLinks.map((row) => (
              <OperationalSurfaceLinkCard
                key={row.id}
                href={row.href}
                eyebrow="Saved view"
                title={row.name}
                icon={Bookmark}
                tone="neutral"
                chips={[{ label: "Type", value: row.viewType }]}
                actionLabel="Load saved view"
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
