import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { getOrgUsageStats } from "@/lib/usage-stats";
import { orgHasActivePlan } from "@/lib/plan";

export type DashboardOrgMetrics = {
  totalContracts: number;
  pendingReview: number;
  activeContracts: number;
  atRiskContracts: number;
  teamOpenTasks: number;
  teamOpenObligations: number;
  extractedFieldsTotal: number;
  approvedOperationalDateFields: number;
};

export type NavBadgeCounts = {
  reviewQueue: number;
  approvals: number;
  obligations: number;
  watchlists: number;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return Number(v) || 0;
}

export async function fetchDashboardOrgMetrics(
  orgId: string
): Promise<DashboardOrgMetrics> {
  const admin = await createAdminClient();
  const { data, error } = await admin.rpc("dashboard_org_metrics", {
    p_org_id: orgId,
  });
  if (error) {
    console.error("[dashboard] dashboard_org_metrics rpc failed:", error.message);
    throw new Error("Could not load dashboard metrics");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      totalContracts: 0,
      pendingReview: 0,
      activeContracts: 0,
      atRiskContracts: 0,
      teamOpenTasks: 0,
      teamOpenObligations: 0,
      extractedFieldsTotal: 0,
      approvedOperationalDateFields: 0,
    };
  }
  const r = row as Record<string, unknown>;
  return {
    totalContracts: num(r.total_contracts),
    pendingReview: num(r.pending_review),
    activeContracts: num(r.active_contracts),
    atRiskContracts: num(r.at_risk),
    teamOpenTasks: num(r.open_tasks),
    teamOpenObligations: num(r.open_obligations),
    extractedFieldsTotal: num(r.extracted_fields_total),
    approvedOperationalDateFields: num(r.approved_operational_date_fields),
  };
}

export const getDashboardOrgMetricsCached = cache(fetchDashboardOrgMetrics);

export async function fetchNavBadgeCounts(
  orgId: string,
  userId: string
): Promise<NavBadgeCounts> {
  const admin = await createAdminClient();
  const { data, error } = await admin.rpc("org_nav_badge_counts", {
    p_org_id: orgId,
    p_user_id: userId,
  });
  if (error) {
    console.error("[nav] org_nav_badge_counts rpc failed:", error.message);
    throw new Error("Could not load nav badges");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { reviewQueue: 0, approvals: 0, obligations: 0, watchlists: 0 };
  }
  const r = row as Record<string, unknown>;
  return {
    reviewQueue: num(r.review_queue),
    approvals: num(r.approvals_pending),
    obligations: num(r.obligations_open),
    watchlists: num(r.watchlists),
  };
}

export const getNavBadgeCountsCached = cache(fetchNavBadgeCounts);

export const getDashboardMissingCriticalCached = cache(
  async (orgId: string) => {
    const admin = await createAdminClient();
    return getContractsMissingCriticalFields(admin, orgId);
  }
);

export const getDashboardUsageStatsCached = cache(async (orgId: string) => {
  const admin = await createAdminClient();
  return getOrgUsageStats(admin, orgId);
});

export const getProfileOnboardingCached = cache(async (userId: string) => {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  return data;
});

export const getOrgHasActivePlanCached = cache(async (orgId: string) => {
  const admin = await createAdminClient();
  return orgHasActivePlan(admin, orgId);
});

export const getDashboardDateFieldsCached = cache(async (orgId: string) => {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("extracted_fields")
    .select("id, field_name, field_value, contracts!inner(id, title, organization_id)")
    .eq("contracts.organization_id", orgId)
    .eq("status", "approved")
    .in("field_name", ["notice_window", "renewal_date", "end_date"])
    .not("field_value", "is", null);
  return data ?? [];
});

export const getDashboardWorkflowSettingsCached = cache(async (orgId: string) => {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("organization_workflow_settings")
    .select("dashboard_tracking_enabled, dashboard_pins_json")
    .eq("organization_id", orgId)
    .maybeSingle();
  return data;
});

export const getPinnedSavedViewsCached = cache(async (orgId: string) => {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("saved_views")
    .select("id, name, view_type, query_json, pinned")
    .eq("organization_id", orgId)
    .eq("pinned", true)
    .order("updated_at", { ascending: false })
    .limit(6);
  return data ?? [];
});
