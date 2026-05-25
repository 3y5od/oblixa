import type {
  V10MutationOutcome,
  V10Plan,
  V10Role,
  V10VisibilityState,
  V10WorkspaceMode,
} from "./release-contract";
import {
  getV10PlanRank,
  getV10RoleRank,
  getV10WorkspaceModeRank,
} from "./release-contract";

export type V10EligibilityInput = {
  workspaceMode: V10WorkspaceMode;
  requiredMode: V10WorkspaceMode;
  role: V10Role;
  requiredRole: V10Role;
  plan: V10Plan;
  requiredPlan: V10Plan;
  moduleHidden?: boolean;
  sameOrganization?: boolean;
  archived?: boolean;
  deleted?: boolean;
  action?: "restore" | "audit_read" | "export_history_read" | "normal";
};

export type V10EligibilityResult = {
  allowed: boolean;
  visibilityState: V10VisibilityState;
  outcome: V10MutationOutcome;
  reason: string | null;
};
export type V10GovernanceHealthState =
  | "healthy"
  | "access_limited"
  | "configuration_required"
  | "recovery_visible";

export type V10SettingsHealthDiagnostic = {
  key: string;
  severity: "info" | "attention" | "risk";
  userVisibleSummary: string;
  recoveryHref: string;
};

/** Post-GA operational SLO window breach (§2.2) surfaced on workspace health. */
export type V10PostGaOperationalSloMiss = {
  window: "7d" | "30d";
  sloKey: string;
  observedSummary: string;
};

export function evaluateV10Eligibility(input: V10EligibilityInput): V10EligibilityResult {
  if (input.sameOrganization === false) {
    return { allowed: false, visibilityState: "hidden_by_role", outcome: "not_found", reason: "wrong_organization" };
  }
  const archiveAllowed =
    input.action === "restore" || input.action === "audit_read" || input.action === "export_history_read";
  if (input.deleted && !archiveAllowed) {
    return { allowed: false, visibilityState: "deleted", outcome: "not_found", reason: "deleted" };
  }
  if (input.archived && !archiveAllowed) {
    return { allowed: false, visibilityState: "archived", outcome: "not_found", reason: "archived" };
  }
  if (getV10WorkspaceModeRank(input.workspaceMode) < getV10WorkspaceModeRank(input.requiredMode)) {
    return { allowed: false, visibilityState: "hidden_by_mode", outcome: "mode_required", reason: "workspace_mode_required" };
  }
  if (getV10RoleRank(input.role) < getV10RoleRank(input.requiredRole)) {
    return { allowed: false, visibilityState: "hidden_by_role", outcome: "forbidden", reason: "role_required" };
  }
  if (getV10PlanRank(input.plan) < getV10PlanRank(input.requiredPlan)) {
    return { allowed: false, visibilityState: "hidden_by_plan", outcome: "plan_required", reason: "plan_required" };
  }
  if (input.moduleHidden) {
    return { allowed: false, visibilityState: "hidden_by_module", outcome: "hidden_module", reason: "module_hidden" };
  }
  return { allowed: true, visibilityState: "visible", outcome: "success", reason: null };
}

export function getV10EligibleFallbackDestination(result: V10EligibilityResult): string {
  if (result.allowed) return "current_destination";
  if (result.outcome === "plan_required") return "/settings/billing";
  if (result.outcome === "mode_required" || result.outcome === "hidden_module") return "/settings/product";
  if (result.outcome === "forbidden") return "/dashboard";
  return "/dashboard";
}

export function getV10GovernanceHealthState(input: {
  eligibility?: V10EligibilityResult | null;
  failedJobCount?: number;
  staleReadModelCount?: number;
  notificationFailureCount?: number;
  hiddenModuleCount?: number;
}): V10GovernanceHealthState {
  if (input.eligibility && !input.eligibility.allowed) {
    return input.eligibility.outcome === "forbidden" ? "access_limited" : "configuration_required";
  }
  if ((input.hiddenModuleCount ?? 0) > 0) return "configuration_required";
  if ((input.failedJobCount ?? 0) > 0 || (input.staleReadModelCount ?? 0) > 0 || (input.notificationFailureCount ?? 0) > 0) {
    return "recovery_visible";
  }
  return "healthy";
}

export function buildV10SettingsHealthDiagnostics(input: {
  failedJobCount?: number;
  staleReadModelCount?: number;
  notificationFailureCount?: number;
  hiddenModuleCount?: number;
  releaseBlockerCount?: number;
  /** v10.md §2.2: post-GA SLO misses must create workspace health diagnostics. */
  postGaOperationalSloMisses?: readonly V10PostGaOperationalSloMiss[];
}): V10SettingsHealthDiagnostic[] {
  const diagnostics: V10SettingsHealthDiagnostic[] = [];
  for (const miss of input.postGaOperationalSloMisses ?? []) {
    const windowLabel = miss.window === "7d" ? "7-day" : "30-day";
    diagnostics.push({
      key: `post_ga_operational_slo:${miss.window}:${miss.sloKey}`,
      severity: "attention",
      userVisibleSummary: `${windowLabel} post-GA operational SLO (${miss.sloKey}): ${miss.observedSummary}`,
      recoveryHref: "/settings/health#v10-post-ga-slo",
    });
  }
  if ((input.failedJobCount ?? 0) > 0) {
    diagnostics.push({
      key: "failed_jobs",
      severity: (input.failedJobCount ?? 0) >= 3 ? "risk" : "attention",
      userVisibleSummary: `${input.failedJobCount} failed or partial job${input.failedJobCount === 1 ? "" : "s"} need recovery.`,
      recoveryHref: "/settings/health#v10-jobs",
    });
  }
  if ((input.staleReadModelCount ?? 0) > 0) {
    diagnostics.push({
      key: "stale_read_models",
      severity: "risk",
      userVisibleSummary: `${input.staleReadModelCount} read-model refresh issue${input.staleReadModelCount === 1 ? "" : "s"} need repair.`,
      recoveryHref: "/settings/health#v10-refresh",
    });
  }
  if ((input.notificationFailureCount ?? 0) > 0) {
    diagnostics.push({
      key: "notification_failures",
      severity: (input.notificationFailureCount ?? 0) >= 10 ? "risk" : "attention",
      userVisibleSummary: `${input.notificationFailureCount} notification delivery issue${input.notificationFailureCount === 1 ? "" : "s"} are visible.`,
      recoveryHref: "/settings/health#notifications",
    });
  }
  if ((input.hiddenModuleCount ?? 0) > 0 || (input.releaseBlockerCount ?? 0) > 0) {
    diagnostics.push({
      key: "governance_configuration",
      severity: "attention",
      userVisibleSummary: "Workspace configuration or release gates need review.",
      recoveryHref: "/settings/product",
    });
  }
  return diagnostics;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10SettingsHealthDiagnostics as buildSettingsHealthDiagnostics };
export { evaluateV10Eligibility as evaluateEligibility };
export { getV10EligibleFallbackDestination as getEligibleFallbackDestination };
export { getV10GovernanceHealthState as getGovernanceHealthState };
export type { V10EligibilityInput as EligibilityInput };
export type { V10EligibilityResult as EligibilityResult };
export type { V10GovernanceHealthState as GovernanceHealthState };
export type { V10PostGaOperationalSloMiss as PostGaOperationalSloMiss };
export type { V10SettingsHealthDiagnostic as SettingsHealthDiagnostic };
// End version-name compatibility aliases.
