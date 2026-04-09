type FeatureFlagKey =
  | "v3TasksEngine"
  | "v3ObligationsExecution"
  | "v3ApprovalsSla"
  | "v3RenewalWorkspace"
  | "v3IntakePipeline"
  | "v3PersonaDashboards"
  | "v3ReportingHistory"
  | "v3AutomationExpansion";

const envMap: Record<FeatureFlagKey, string> = {
  v3TasksEngine: "ENABLE_V3_TASKS_ENGINE",
  v3ObligationsExecution: "ENABLE_V3_OBLIGATIONS_EXECUTION",
  v3ApprovalsSla: "ENABLE_V3_APPROVALS_SLA",
  v3RenewalWorkspace: "ENABLE_V3_RENEWAL_WORKSPACE",
  v3IntakePipeline: "ENABLE_V3_INTAKE_PIPELINE",
  v3PersonaDashboards: "ENABLE_V3_PERSONA_DASHBOARDS",
  v3ReportingHistory: "ENABLE_V3_REPORTING_HISTORY",
  v3AutomationExpansion: "ENABLE_V3_AUTOMATION_EXPANSION",
};

/** V4 default: modules are on unless explicitly disabled (unset / empty = enabled). */
function parseFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no" ||
    normalized === "off"
  ) {
    return false;
  }
  return true;
}

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return parseFlag(process.env[envMap[key]]);
}

export function getFeatureFlags(): Record<FeatureFlagKey, boolean> {
  return {
    v3TasksEngine: isFeatureEnabled("v3TasksEngine"),
    v3ObligationsExecution: isFeatureEnabled("v3ObligationsExecution"),
    v3ApprovalsSla: isFeatureEnabled("v3ApprovalsSla"),
    v3RenewalWorkspace: isFeatureEnabled("v3RenewalWorkspace"),
    v3IntakePipeline: isFeatureEnabled("v3IntakePipeline"),
    v3PersonaDashboards: isFeatureEnabled("v3PersonaDashboards"),
    v3ReportingHistory: isFeatureEnabled("v3ReportingHistory"),
    v3AutomationExpansion: isFeatureEnabled("v3AutomationExpansion"),
  };
}
