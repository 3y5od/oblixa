export type FeatureFlagKey =
  | "v3TasksEngine"
  | "v3ObligationsExecution"
  | "v3ApprovalsSla"
  | "v3RenewalWorkspace"
  | "v3IntakePipeline"
  | "v3PersonaDashboards"
  | "v3ReportingHistory"
  | "v3AutomationExpansion"
  | "v5DecisionFoundation"
  | "v5PortfolioCampaigns"
  | "v5SimulationAndIntelligence"
  | "v5RelationshipLayer"
  | "v5ExternalCollaboration"
  | "v5ControlRoomUx"
  | "v6AssuranceCore"
  | "v6ControlPolicies"
  | "v6AdaptivePlaybooks"
  | "v6Autopilot"
  | "v6OutcomeIntelligence"
  | "v6ReviewBoards"
  | "v6Segments"
  | "v6AutopilotAllowExecution";

const envMap: Record<FeatureFlagKey, string> = {
  v3TasksEngine: "ENABLE_V3_TASKS_ENGINE",
  v3ObligationsExecution: "ENABLE_V3_OBLIGATIONS_EXECUTION",
  v3ApprovalsSla: "ENABLE_V3_APPROVALS_SLA",
  v3RenewalWorkspace: "ENABLE_V3_RENEWAL_WORKSPACE",
  v3IntakePipeline: "ENABLE_V3_INTAKE_PIPELINE",
  v3PersonaDashboards: "ENABLE_V3_PERSONA_DASHBOARDS",
  v3ReportingHistory: "ENABLE_V3_REPORTING_HISTORY",
  v3AutomationExpansion: "ENABLE_V3_AUTOMATION_EXPANSION",
  v5DecisionFoundation: "ENABLE_V5_DECISION_FOUNDATION",
  v5PortfolioCampaigns: "ENABLE_V5_PORTFOLIO_CAMPAIGNS",
  v5SimulationAndIntelligence: "ENABLE_V5_SIMULATION_AND_INTELLIGENCE",
  v5RelationshipLayer: "ENABLE_V5_RELATIONSHIP_LAYER",
  v5ExternalCollaboration: "ENABLE_V5_EXTERNAL_COLLABORATION",
  v5ControlRoomUx: "ENABLE_V5_CONTROL_ROOM_UX",
  v6AssuranceCore: "ENABLE_V6_ASSURANCE_CORE",
  v6ControlPolicies: "ENABLE_V6_CONTROL_POLICIES",
  v6AdaptivePlaybooks: "ENABLE_V6_ADAPTIVE_PLAYBOOKS",
  v6Autopilot: "ENABLE_V6_AUTOPILOT",
  v6OutcomeIntelligence: "ENABLE_V6_OUTCOME_INTELLIGENCE",
  v6ReviewBoards: "ENABLE_V6_REVIEW_BOARDS",
  v6Segments: "ENABLE_V6_SEGMENTS",
  /** When false, autopilot performs dry-runs only (no mutating execute path). Default on when unset. */
  v6AutopilotAllowExecution: "ENABLE_V6_AUTOPILOT_ALLOW_EXECUTION",
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

let cachedFlags: Record<FeatureFlagKey, boolean> | null = null;

function readFlagsOnce(): Record<FeatureFlagKey, boolean> {
  if (cachedFlags) return cachedFlags;
  cachedFlags = {
    v3TasksEngine: isFeatureEnabled("v3TasksEngine"),
    v3ObligationsExecution: isFeatureEnabled("v3ObligationsExecution"),
    v3ApprovalsSla: isFeatureEnabled("v3ApprovalsSla"),
    v3RenewalWorkspace: isFeatureEnabled("v3RenewalWorkspace"),
    v3IntakePipeline: isFeatureEnabled("v3IntakePipeline"),
    v3PersonaDashboards: isFeatureEnabled("v3PersonaDashboards"),
    v3ReportingHistory: isFeatureEnabled("v3ReportingHistory"),
    v3AutomationExpansion: isFeatureEnabled("v3AutomationExpansion"),
    v5DecisionFoundation: isFeatureEnabled("v5DecisionFoundation"),
    v5PortfolioCampaigns: isFeatureEnabled("v5PortfolioCampaigns"),
    v5SimulationAndIntelligence: isFeatureEnabled("v5SimulationAndIntelligence"),
    v5RelationshipLayer: isFeatureEnabled("v5RelationshipLayer"),
    v5ExternalCollaboration: isFeatureEnabled("v5ExternalCollaboration"),
    v5ControlRoomUx: isFeatureEnabled("v5ControlRoomUx"),
    v6AssuranceCore: isFeatureEnabled("v6AssuranceCore"),
    v6ControlPolicies: isFeatureEnabled("v6ControlPolicies"),
    v6AdaptivePlaybooks: isFeatureEnabled("v6AdaptivePlaybooks"),
    v6Autopilot: isFeatureEnabled("v6Autopilot"),
    v6OutcomeIntelligence: isFeatureEnabled("v6OutcomeIntelligence"),
    v6ReviewBoards: isFeatureEnabled("v6ReviewBoards"),
    v6Segments: isFeatureEnabled("v6Segments"),
    v6AutopilotAllowExecution: isFeatureEnabled("v6AutopilotAllowExecution"),
  };
  return cachedFlags;
}

export function getFeatureFlags(): Record<FeatureFlagKey, boolean> {
  return { ...readFlagsOnce() };
}
