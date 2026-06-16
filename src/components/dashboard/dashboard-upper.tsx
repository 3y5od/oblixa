import Link from "next/link";
import { DashboardPersonaPresets } from "@/components/dashboard/dashboard-persona-presets";
import {
  OnboardingBanner,
  type OnboardingActivationStats,
} from "@/components/dashboard/onboarding-banner";
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
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";
import type { WorkspaceRole } from "@/lib/navigation";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import type { ProductSurfaceContext } from "@/lib/product-surface/context";
import { isHrefEligibleForProductSurface } from "@/lib/product-surface/href-eligibility";
import {
  buildDashboardUpperCommandViewLinks,
  buildDashboardUpperFocusCards,
} from "./dashboard-upper-focus-cards";
import { DashboardUpperHeader } from "./dashboard-upper-header";
import { DashboardUpperPinnedViews } from "./dashboard-upper-pinned-views";
import { DashboardUpperTopCards } from "./dashboard-upper-top-cards";

export async function DashboardUpper(props: {
  orgId: string;
  userId: string;
  role: WorkspaceRole;
  view: "personal" | "team" | "portfolio";
  quickFilter: "all" | "approvals" | "deadlines" | "data_gaps";
  workspaceProductMode?: WorkspaceProductMode;
  productSurfaceContext: ProductSurfaceContext;
}) {
  const { orgId, userId, role, view, workspaceProductMode, productSurfaceContext } = props;
  const isCoreHome = workspaceProductMode === "core";
  const isHrefEligible = (href: string) => isHrefEligibleForProductSurface(productSurfaceContext, href);
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
    admin.from("organizations").select("name, plan_tier").eq("id", orgId).maybeSingle(),
  ]);

  const orgIdentity = (orgIdentityRes.data as { name?: string; plan_tier?: string } | null) ?? null;
  const workspaceName = orgIdentity?.name?.trim() || "Workspace";
  const onboardingCalibration = parseOnboardingCalibration(v6OrgSettings.onboarding_calibration);
  const calibrationBlocking = isOnboardingBlockingForAdmin({ role, calibration: onboardingCalibration });

  if (workflowSettings?.dashboard_tracking_enabled !== false) {
    await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: null,
      user_id: userId,
      action: "dashboard.viewed",
      details: { view },
    });
  }

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
  const importJobCompletedInserts = latestImportJob?.status === "completed" && (latestImportJob.inserted_rows ?? 0) > 0;
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

  const commandViewLinks = buildDashboardUpperCommandViewLinks({ pinnedSavedViews, isHrefEligible });
  const displayFocusCards = buildDashboardUpperFocusCards({ metrics, operationalSignals, isHrefEligible });
  const showPlanBanner = enforcePlan && !hasActivePlan;
  const showOnboarding = !profileRow?.onboarding_completed_at && !calibrationBlocking;
  const showPersonaPresets = isFeatureEnabled("v3PersonaDashboards") && !isCoreHome;
  const manageSavedViewsHref = isHrefEligible("/contracts/tasks") ? "/contracts/tasks" : "/contracts";

  return (
    <>
      {showOnboarding ? <OnboardingBanner stats={onboardingStats} setupChecklist={setupChecklist} /> : null}
      {showPlanBanner ? (
        <div className="ui-alert-warning flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed">
            <span className="font-semibold">Subscription required</span> to create or edit contracts.
          </p>
          <Link href="/settings/billing" className="ui-btn-secondary shrink-0 px-4 py-2 text-[12.5px]">
            Billing
          </Link>
        </div>
      ) : null}

      <DashboardUpperHeader
        workspaceName={workspaceName}
        hasWorkspaceName={Boolean(orgIdentity?.name?.trim())}
        planTier={orgIdentity?.plan_tier?.trim() || undefined}
        totalContracts={metrics.totalContracts}
        pendingReview={metrics.pendingReview}
        showPersonaPresets={showPersonaPresets}
      />

      {onboardingCalibration?.last_recommendation &&
      onboardingCalibration.answers_optional?.org_role &&
      onboardingCalibration.answers_optional.org_role !== "unspecified" ? (
        <p className="max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {dashboardOrgRoleCalibrationNudge}
        </p>
      ) : null}

      <DashboardUpperTopCards cards={displayFocusCards} />
      {showPersonaPresets ? <DashboardPersonaPresets /> : null}
      <DashboardUpperPinnedViews
        commandViewLinks={commandViewLinks}
        manageSavedViewsHref={manageSavedViewsHref}
      />
    </>
  );
}
