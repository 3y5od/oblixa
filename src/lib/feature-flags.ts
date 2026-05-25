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

export type FeatureFlagEnvAlias = {
  neutral: string;
  legacy: string;
};

export const FEATURE_FLAG_ENV_ALIASES: Record<FeatureFlagKey, FeatureFlagEnvAlias> = {
  v3TasksEngine: { neutral: "ENABLE_TASKS_ENGINE", legacy: "ENABLE_V3_TASKS_ENGINE" },
  v3ObligationsExecution: { neutral: "ENABLE_OBLIGATIONS_EXECUTION", legacy: "ENABLE_V3_OBLIGATIONS_EXECUTION" },
  v3ApprovalsSla: { neutral: "ENABLE_APPROVALS_SLA", legacy: "ENABLE_V3_APPROVALS_SLA" },
  v3RenewalWorkspace: { neutral: "ENABLE_RENEWAL_WORKSPACE", legacy: "ENABLE_V3_RENEWAL_WORKSPACE" },
  v3IntakePipeline: { neutral: "ENABLE_INTAKE_PIPELINE", legacy: "ENABLE_V3_INTAKE_PIPELINE" },
  v3PersonaDashboards: { neutral: "ENABLE_PERSONA_DASHBOARDS", legacy: "ENABLE_V3_PERSONA_DASHBOARDS" },
  v3ReportingHistory: { neutral: "ENABLE_REPORTING_HISTORY", legacy: "ENABLE_V3_REPORTING_HISTORY" },
  v3AutomationExpansion: { neutral: "ENABLE_AUTOMATION_EXPANSION", legacy: "ENABLE_V3_AUTOMATION_EXPANSION" },
  v5DecisionFoundation: { neutral: "ENABLE_DECISION_FOUNDATION", legacy: "ENABLE_V5_DECISION_FOUNDATION" },
  v5PortfolioCampaigns: { neutral: "ENABLE_PORTFOLIO_CAMPAIGNS", legacy: "ENABLE_V5_PORTFOLIO_CAMPAIGNS" },
  v5SimulationAndIntelligence: {
    neutral: "ENABLE_SIMULATION_AND_INTELLIGENCE",
    legacy: "ENABLE_V5_SIMULATION_AND_INTELLIGENCE",
  },
  v5RelationshipLayer: { neutral: "ENABLE_RELATIONSHIP_LAYER", legacy: "ENABLE_V5_RELATIONSHIP_LAYER" },
  v5ExternalCollaboration: { neutral: "ENABLE_EXTERNAL_COLLABORATION", legacy: "ENABLE_V5_EXTERNAL_COLLABORATION" },
  v5ControlRoomUx: { neutral: "ENABLE_CONTROL_ROOM_UX", legacy: "ENABLE_V5_CONTROL_ROOM_UX" },
  v6AssuranceCore: { neutral: "ENABLE_ASSURANCE_CORE", legacy: "ENABLE_V6_ASSURANCE_CORE" },
  v6ControlPolicies: { neutral: "ENABLE_CONTROL_POLICIES", legacy: "ENABLE_V6_CONTROL_POLICIES" },
  v6AdaptivePlaybooks: { neutral: "ENABLE_ADAPTIVE_PLAYBOOKS", legacy: "ENABLE_V6_ADAPTIVE_PLAYBOOKS" },
  v6Autopilot: { neutral: "ENABLE_AUTOPILOT", legacy: "ENABLE_V6_AUTOPILOT" },
  v6OutcomeIntelligence: { neutral: "ENABLE_OUTCOME_INTELLIGENCE", legacy: "ENABLE_V6_OUTCOME_INTELLIGENCE" },
  v6ReviewBoards: { neutral: "ENABLE_REVIEW_BOARDS", legacy: "ENABLE_V6_REVIEW_BOARDS" },
  v6Segments: { neutral: "ENABLE_SEGMENTS", legacy: "ENABLE_V6_SEGMENTS" },
  /** When false, autopilot performs dry-runs only (no mutating execute path). Default on when unset. */
  v6AutopilotAllowExecution: {
    neutral: "ENABLE_AUTOPILOT_ALLOW_EXECUTION",
    legacy: "ENABLE_V6_AUTOPILOT_ALLOW_EXECUTION",
  },
};

export const TRUE_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);
export const FALSE_FLAG_VALUES = new Set(["0", "false", "no", "off"]);
export const UNSAFE_FLAG_VALUE_RE =
  /(?:^|[_\-\s])(bypass|skip|skip_auth|no_auth|disable_auth|auth_disabled|permissive|security_disabled)(?:$|[_\-\s])/i;

/** V4 default: modules are on unless explicitly disabled (unset / empty = enabled). */
export function parseFeatureFlagEnv(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  if (FALSE_FLAG_VALUES.has(normalized)) return false;
  if (TRUE_FLAG_VALUES.has(normalized) && !UNSAFE_FLAG_VALUE_RE.test(normalized)) return true;
  return false;
}

export function readFeatureFlagEnvValue(key: FeatureFlagKey, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const keys = FEATURE_FLAG_ENV_ALIASES[key];
  return env[keys.neutral] ?? env[keys.legacy];
}

export function isFeatureEnabled(key: FeatureFlagKey, env: NodeJS.ProcessEnv = process.env): boolean {
  return parseFeatureFlagEnv(readFeatureFlagEnvValue(key, env));
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
