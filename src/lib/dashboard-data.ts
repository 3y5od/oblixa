import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { EVIDENCE_GAP_STATUSES } from "@/lib/evidence-status";
import { getContractsMissingCriticalFields } from "@/lib/missing-critical-fields";
import { getOrgUsageStats } from "@/lib/usage-stats";
import { orgHasActivePlan } from "@/lib/plan";
import { V9_DUE_SOON_DAYS } from "@/lib/v9-business-dates";

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

export type DashboardOperationalSignals = {
  assignedWork: number;
  dueSoonAssignedWork: number;
  pendingApprovals: number;
  openExceptions: number;
  outstandingEvidence: number;
  renewalAttention: number;
  recentChanges: number;
  ownerAssignedContracts: number;
  visibleWorkItems: number;
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

export const getDashboardAdminClientCached = cache(async () => createAdminClient());

export async function fetchDashboardOrgMetrics(
  orgId: string
): Promise<DashboardOrgMetrics> {
  const admin = await getDashboardAdminClientCached();
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

/**
 * Loads metrics via one SQL RPC (avoids N+1 client queries). Wrapped in React `cache()` for
 * per-request dedupe — call `revalidatePath` after mutations so KPIs stay fresh.
 */
export const getDashboardOrgMetricsCached = cache(fetchDashboardOrgMetrics);

export async function fetchNavBadgeCounts(
  orgId: string,
  userId: string
): Promise<NavBadgeCounts> {
  const admin = await getDashboardAdminClientCached();
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
    const admin = await getDashboardAdminClientCached();
    return getContractsMissingCriticalFields(admin, orgId);
  }
);

export const getDashboardUsageStatsCached = cache(async (orgId: string) => {
  const admin = await getDashboardAdminClientCached();
  return getOrgUsageStats(admin, orgId);
});

export const getProfileOnboardingCached = cache(async (userId: string) => {
  const admin = await getDashboardAdminClientCached();
  const { data, error } = await admin
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[dashboard] getProfileOnboardingCached query error:", error.message);
  }
  return data;
});

/** §4.4 — billing/subscription checks only (e.g. dashboard plan banner), not product IA. */
export const getOrgHasActivePlanCached = cache(async (orgId: string) => {
  const admin = await getDashboardAdminClientCached();
  return orgHasActivePlan(admin, orgId);
});

export const getDashboardDateFieldsCached = cache(async (orgId: string) => {
  const admin = await getDashboardAdminClientCached();
  const { data } = await admin
    .from("extracted_fields")
    .select("id, field_name, field_value, contracts!inner(id, title, organization_id)")
    .eq("contracts.organization_id", orgId)
    .eq("status", "approved")
    .in("field_name", ["notice_window", "renewal_date", "end_date"])
    .not("field_value", "is", null)
    .order("updated_at", { ascending: false })
    .limit(2000);
  return data ?? [];
});

export const getDashboardWorkflowSettingsCached = cache(async (orgId: string) => {
  const admin = await getDashboardAdminClientCached();
  const { data } = await admin
    .from("organization_workflow_settings")
    .select("dashboard_tracking_enabled, dashboard_pins_json")
    .eq("organization_id", orgId)
    .maybeSingle();
  return data;
});

export const getPinnedSavedViewsCached = cache(async (orgId: string) => {
  const admin = await getDashboardAdminClientCached();
  const { data } = await admin
    .from("saved_views")
    .select("id, name, view_type, query_json, pinned")
    .eq("organization_id", orgId)
    .eq("pinned", true)
    .order("updated_at", { ascending: false })
    .limit(6);
  return data ?? [];
});

export const getDashboardOperationalSignalsCached = cache(
  async (orgId: string, userId: string): Promise<DashboardOperationalSignals> => {
    const admin = await getDashboardAdminClientCached();
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const soonDateIso = new Date(today.getTime() + V9_DUE_SOON_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const reviewWindowIso = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const renewalWindowIso = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [
      assignedTasksRes,
      dueSoonTasksRes,
      assignedObligationsRes,
      dueSoonObligationsRes,
      assignedApprovalsRes,
      dueSoonApprovalsRes,
      pendingApprovalsRes,
      openExceptionsRes,
      outstandingEvidenceRes,
      recentChangesRes,
      ownerAssignedContractsRes,
      renewalAttentionFieldsRes,
    ] = await Promise.all([
      admin
        .from("contract_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("assignee_id", userId)
        .in("status", ["open", "in_progress", "blocked"]),
      admin
        .from("contract_tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("assignee_id", userId)
        .in("status", ["open", "in_progress", "blocked"])
        .not("due_date", "is", null)
        .gte("due_date", todayIso)
        .lte("due_date", soonDateIso),
      admin
        .from("contract_obligations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("owner_id", userId)
        .in("status", ["open", "in_progress"]),
      admin
        .from("contract_obligations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("owner_id", userId)
        .in("status", ["open", "in_progress"])
        .not("due_date", "is", null)
        .gte("due_date", todayIso)
        .lte("due_date", soonDateIso),
      admin
        .from("contract_approvals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("approver_id", userId)
        .eq("status", "pending"),
      admin
        .from("contract_approvals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("approver_id", userId)
        .eq("status", "pending")
        .not("due_at", "is", null)
        .gte("due_at", today.toISOString())
        .lte(
          "due_at",
          new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
        ),
      admin
        .from("contract_approvals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "pending"),
      admin
        .from("exceptions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress"]),
      admin
        .from("evidence_requirements")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", [...EVIDENCE_GAP_STATUSES]),
      admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("updated_at", reviewWindowIso),
      admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .not("owner_id", "is", null),
      admin
        .from("extracted_fields")
        .select("contract_id, contracts!inner(organization_id, status)")
        .eq("contracts.organization_id", orgId)
        .eq("status", "approved")
        .eq("field_name", "renewal_date")
        .not("field_value", "is", null)
        .gte("field_value", todayIso)
        .lte("field_value", renewalWindowIso),
    ]);

    const assignedWork =
      (assignedTasksRes.count ?? 0) +
      (assignedObligationsRes.count ?? 0) +
      (assignedApprovalsRes.count ?? 0);
    const dueSoonAssignedWork =
      (dueSoonTasksRes.count ?? 0) +
      (dueSoonObligationsRes.count ?? 0) +
      (dueSoonApprovalsRes.count ?? 0);

    const renewalAttention = new Set(
      (renewalAttentionFieldsRes.data ?? []).flatMap((row) =>
        typeof row.contract_id === "string" ? [row.contract_id] : []
      )
    ).size;

    return {
      assignedWork,
      dueSoonAssignedWork,
      pendingApprovals: pendingApprovalsRes.count ?? 0,
      openExceptions: openExceptionsRes.count ?? 0,
      outstandingEvidence: outstandingEvidenceRes.count ?? 0,
      renewalAttention,
      recentChanges: recentChangesRes.count ?? 0,
      ownerAssignedContracts: ownerAssignedContractsRes.count ?? 0,
      visibleWorkItems:
        (assignedTasksRes.count ?? 0) +
        (assignedObligationsRes.count ?? 0) +
        (pendingApprovalsRes.count ?? 0),
    };
  }
);
