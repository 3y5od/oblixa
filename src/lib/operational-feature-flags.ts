import {
  FEATURE_FLAG_ENV_ALIASES,
  type FeatureFlagKey,
} from "@/lib/feature-flags";
import {
  isKillBilling,
  isKillCronFamily,
  isKillExtraction,
  isKillImportExport,
  isKillInboundAutomation,
  isKillIntegrationSync,
  isKillInvites,
  isKillOutboundEmail,
  isKillSignup,
  isKillWebhookDispatch,
  killSwitchAccessibleState,
  killSwitchOperationalTelemetry,
} from "@/lib/security/kill-switches";

export type OperationalFlagDefaults = {
  local: boolean;
  test: boolean;
  preview: boolean;
  production: boolean;
};

export type OperationalFeatureFlagContract = {
  key: FeatureFlagKey;
  envName: string;
  legacyAliases: readonly string[];
  defaultByEnvironment: OperationalFlagDefaults;
  ownerArea: string;
  rolloutState: "default_on" | "default_off" | "partial" | "internal_only" | "execution_guard";
  expiresOn: string;
  cleanupPlan: string;
  removalTicket: string;
  killSwitchBehavior: string;
  publicExposure: "private";
  sensitivity: "none" | "operational-sensitive";
  validationCommand: "check:operational-feature-flags-rollout";
  testRefs: readonly string[];
};

type OperationalFeatureFlagMetadata = Omit<
  OperationalFeatureFlagContract,
  "key" | "envName" | "legacyAliases" | "validationCommand" | "publicExposure"
>;

const DEFAULT_ON: OperationalFlagDefaults = {
  local: true,
  test: true,
  preview: true,
  production: true,
};

const DEFAULT_OFF: OperationalFlagDefaults = {
  local: false,
  test: false,
  preview: false,
  production: false,
};

const FEATURE_FLAG_METADATA: Record<FeatureFlagKey, OperationalFeatureFlagMetadata> = {
  v3TasksEngine: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-workflow",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_TASKS_ENGINE alias after every deployed environment uses ENABLE_TASKS_ENGINE.",
    removalTicket: "OPH-025-FLAG-v3TasksEngine",
    killSwitchBehavior: "Disable task-engine surfaces and retain read-only contract views.",
    sensitivity: "none",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v3ObligationsExecution: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-workflow",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_OBLIGATIONS_EXECUTION alias after flag telemetry shows no legacy reads.",
    removalTicket: "OPH-025-FLAG-v3ObligationsExecution",
    killSwitchBehavior: "Disable obligation execution entry points and preserve obligation read paths.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v3ApprovalsSla: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-workflow",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_APPROVALS_SLA alias after SLA rollout has no legacy environment reads.",
    removalTicket: "OPH-025-FLAG-v3ApprovalsSla",
    killSwitchBehavior: "Disable approval SLA write automation while keeping approval history visible.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v3RenewalWorkspace: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-workflow",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_RENEWAL_WORKSPACE alias after renewal workspace is permanently migrated.",
    removalTicket: "OPH-025-FLAG-v3RenewalWorkspace",
    killSwitchBehavior: "Disable renewal workspace mutations and preserve existing contract timeline reads.",
    sensitivity: "none",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v3IntakePipeline: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-activation",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_INTAKE_PIPELINE alias after intake pipeline telemetry is neutral-only.",
    removalTicket: "OPH-025-FLAG-v3IntakePipeline",
    killSwitchBehavior: "Disable intake pipeline writes and leave upload history available.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v3PersonaDashboards: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-experience",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_PERSONA_DASHBOARDS alias after dashboard navigation is neutral-only.",
    removalTicket: "OPH-025-FLAG-v3PersonaDashboards",
    killSwitchBehavior: "Disable persona dashboard modules and retain core dashboard fallback.",
    sensitivity: "none",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v3ReportingHistory: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-reporting",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_REPORTING_HISTORY alias after reporting history reads are neutral-only.",
    removalTicket: "OPH-025-FLAG-v3ReportingHistory",
    killSwitchBehavior: "Disable reporting history enrichment while keeping core exports available.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v3AutomationExpansion: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-automation",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V3_AUTOMATION_EXPANSION alias after automation expansion reads are neutral-only.",
    removalTicket: "OPH-025-FLAG-v3AutomationExpansion",
    killSwitchBehavior: "Disable expanded automation runs and keep manual contract operations available.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v5DecisionFoundation: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "decision-intelligence",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V5_DECISION_FOUNDATION alias after V5 read-model adoption is complete.",
    removalTicket: "OPH-025-FLAG-v5DecisionFoundation",
    killSwitchBehavior: "Disable decision intelligence actions and keep contract system of record available.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v5PortfolioCampaigns: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "decision-intelligence",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V5_PORTFOLIO_CAMPAIGNS alias after campaign controls no longer read it.",
    removalTicket: "OPH-025-FLAG-v5PortfolioCampaigns",
    killSwitchBehavior: "Disable portfolio campaign mutations and keep campaign history visible.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v5SimulationAndIntelligence: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "decision-intelligence",
    rolloutState: "partial",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V5_SIMULATION_AND_INTELLIGENCE alias after simulation rollout graduates.",
    removalTicket: "OPH-025-FLAG-v5SimulationAndIntelligence",
    killSwitchBehavior: "Disable simulation execution while retaining saved scenario reads.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/mutation-rollout.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v5RelationshipLayer: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "decision-intelligence",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V5_RELATIONSHIP_LAYER alias after relationship controls are neutral-only.",
    removalTicket: "OPH-025-FLAG-v5RelationshipLayer",
    killSwitchBehavior: "Disable relationship-layer enrichment and keep base counterparty records visible.",
    sensitivity: "none",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v5ExternalCollaboration: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "collaboration",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V5_EXTERNAL_COLLABORATION alias after external collaboration rollout is neutral-only.",
    removalTicket: "OPH-025-FLAG-v5ExternalCollaboration",
    killSwitchBehavior: "Disable external collaboration writes while preserving token status reads.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v5ControlRoomUx: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "product-experience",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V5_CONTROL_ROOM_UX alias after control room UX is permanently enabled.",
    removalTicket: "OPH-025-FLAG-v5ControlRoomUx",
    killSwitchBehavior: "Disable control-room UX affordances and fall back to core workspace navigation.",
    sensitivity: "none",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6AssuranceCore: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "assurance",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V6_ASSURANCE_CORE alias after assurance core reads are neutral-only.",
    removalTicket: "OPH-025-FLAG-v6AssuranceCore",
    killSwitchBehavior: "Disable assurance core mutations and retain evidence read surfaces.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6ControlPolicies: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "assurance",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V6_CONTROL_POLICIES alias after policy controls stop reading it.",
    removalTicket: "OPH-025-FLAG-v6ControlPolicies",
    killSwitchBehavior: "Disable policy mutation paths and preserve policy read surfaces.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6AdaptivePlaybooks: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "assurance",
    rolloutState: "partial",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V6_ADAPTIVE_PLAYBOOKS alias after adaptive playbook rollout graduates.",
    removalTicket: "OPH-025-FLAG-v6AdaptivePlaybooks",
    killSwitchBehavior: "Disable adaptive playbook execution and retain run history.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/mutation-rollout.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6Autopilot: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "assurance-autopilot",
    rolloutState: "internal_only",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V6_AUTOPILOT alias after autopilot eligibility is governed by contract registry only.",
    removalTicket: "OPH-025-FLAG-v6Autopilot",
    killSwitchBehavior: "Disable autopilot suggestions and execution while preserving read-only recommendations.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6OutcomeIntelligence: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "assurance",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V6_OUTCOME_INTELLIGENCE alias after outcome intelligence reads are neutral-only.",
    removalTicket: "OPH-025-FLAG-v6OutcomeIntelligence",
    killSwitchBehavior: "Disable outcome intelligence recomputation and keep last known outcomes visible.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6ReviewBoards: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "assurance",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V6_REVIEW_BOARDS alias after review board routes are neutral-only.",
    removalTicket: "OPH-025-FLAG-v6ReviewBoards",
    killSwitchBehavior: "Disable review board packet generation and preserve packet history.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6Segments: {
    defaultByEnvironment: DEFAULT_ON,
    ownerArea: "assurance",
    rolloutState: "default_on",
    expiresOn: "2027-12-31",
    cleanupPlan: "Remove legacy ENABLE_V6_SEGMENTS alias after segment feature reads are neutral-only.",
    removalTicket: "OPH-025-FLAG-v6Segments",
    killSwitchBehavior: "Disable segment recomputation and keep existing segment reads available.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  v6AutopilotAllowExecution: {
    defaultByEnvironment: DEFAULT_OFF,
    ownerArea: "assurance-autopilot",
    rolloutState: "execution_guard",
    expiresOn: "2027-12-31",
    cleanupPlan: "Replace environment execution toggle with code-owned rollout gates before production autopilot execution.",
    removalTicket: "OPH-025-FLAG-v6AutopilotAllowExecution",
    killSwitchBehavior: "Force autopilot dry-run mode and block mutating execution.",
    sensitivity: "operational-sensitive",
    testRefs: ["src/lib/feature-flags.kill-switch.contract.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
};

export const OPERATIONAL_FEATURE_FLAG_CONTRACTS: readonly OperationalFeatureFlagContract[] = (
  Object.keys(FEATURE_FLAG_ENV_ALIASES) as FeatureFlagKey[]
).map((key) => {
  const aliases = FEATURE_FLAG_ENV_ALIASES[key];
  return {
    key,
    envName: aliases.neutral,
    legacyAliases: [aliases.legacy],
    ...FEATURE_FLAG_METADATA[key],
    publicExposure: "private",
    validationCommand: "check:operational-feature-flags-rollout",
  } as const;
});

export type OperationalKillSwitchId =
  | "signup-disablement"
  | "billing-mutation-freeze"
  | "extraction-disablement"
  | "outbound-email-disablement"
  | "invites-disablement"
  | "inbound-automation-pause"
  | "webhook-dispatch-pause"
  | "cron-family-pause"
  | "import-export-disablement"
  | "integration-sync-pause";

export type OperationalKillSwitchContract = {
  id: OperationalKillSwitchId;
  envName: string;
  helperName: string;
  helper: () => boolean;
  subsystem: string;
  ownerArea: string;
  defaultState: "off";
  failClosed: true;
  publicExposure: "private";
  accessibleUiState: ReturnType<typeof killSwitchAccessibleState>;
  telemetry: ReturnType<typeof killSwitchOperationalTelemetry>;
  validationCommand: "test:operational-feature-flags";
  testRefs: readonly string[];
};

export const OPERATIONAL_KILL_SWITCH_CONTRACTS: readonly OperationalKillSwitchContract[] = [
  {
    id: "signup-disablement",
    envName: "OBLIXA_KILL_SIGNUP",
    helperName: "isKillSignup",
    helper: isKillSignup,
    subsystem: "signup",
    ownerArea: "growth-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("signup"),
    telemetry: killSwitchOperationalTelemetry("signup"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts"],
  },
  {
    id: "billing-mutation-freeze",
    envName: "OBLIXA_KILL_BILLING",
    helperName: "isKillBilling",
    helper: isKillBilling,
    subsystem: "billing",
    ownerArea: "billing-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("billing"),
    telemetry: killSwitchOperationalTelemetry("billing"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts", "src/app/api/stripe/checkout/route.test.ts"],
  },
  {
    id: "extraction-disablement",
    envName: "OBLIXA_KILL_EXTRACTION",
    helperName: "isKillExtraction",
    helper: isKillExtraction,
    subsystem: "extraction",
    ownerArea: "ingestion-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("extraction"),
    telemetry: killSwitchOperationalTelemetry("extraction"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts", "src/app/api/extract/route.test.ts"],
  },
  {
    id: "outbound-email-disablement",
    envName: "OBLIXA_KILL_OUTBOUND_EMAIL",
    helperName: "isKillOutboundEmail",
    helper: isKillOutboundEmail,
    subsystem: "outbound_email",
    ownerArea: "messaging-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("outbound_email"),
    telemetry: killSwitchOperationalTelemetry("outbound_email"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts", "src/lib/email-provider.test.ts"],
  },
  {
    id: "invites-disablement",
    envName: "OBLIXA_KILL_INVITES",
    helperName: "isKillInvites",
    helper: isKillInvites,
    subsystem: "invites",
    ownerArea: "collaboration-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("invites"),
    telemetry: killSwitchOperationalTelemetry("invites"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts"],
  },
  {
    id: "inbound-automation-pause",
    envName: "OBLIXA_KILL_INBOUND_AUTOMATION",
    helperName: "isKillInboundAutomation",
    helper: isKillInboundAutomation,
    subsystem: "inbound_automation",
    ownerArea: "automation-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("inbound_automation"),
    telemetry: killSwitchOperationalTelemetry("inbound_automation"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts"],
  },
  {
    id: "webhook-dispatch-pause",
    envName: "OBLIXA_KILL_WEBHOOK_DISPATCH",
    helperName: "isKillWebhookDispatch",
    helper: isKillWebhookDispatch,
    subsystem: "webhook_dispatch",
    ownerArea: "integrations-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("webhook_dispatch"),
    telemetry: killSwitchOperationalTelemetry("webhook_dispatch"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts", "src/app/api/webhooks/dispatch/route.test.ts"],
  },
  {
    id: "cron-family-pause",
    envName: "OBLIXA_KILL_CRON_FAMILY",
    helperName: "isKillCronFamily",
    helper: isKillCronFamily,
    subsystem: "cron_family",
    ownerArea: "platform-operations",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("cron_family"),
    telemetry: killSwitchOperationalTelemetry("cron_family"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts", "src/lib/cron/route-runner.test.ts"],
  },
  {
    id: "import-export-disablement",
    envName: "OBLIXA_KILL_IMPORT_EXPORT",
    helperName: "isKillImportExport",
    helper: isKillImportExport,
    subsystem: "import_export",
    ownerArea: "data-movement-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("import_export"),
    telemetry: killSwitchOperationalTelemetry("import_export"),
    validationCommand: "test:operational-feature-flags",
    testRefs: [
      "src/lib/security/kill-switches.test.ts",
      "src/app/api/import/contracts/route.test.ts",
      "src/app/api/export/contracts/route.test.ts",
    ],
  },
  {
    id: "integration-sync-pause",
    envName: "OBLIXA_KILL_INTEGRATION_SYNC",
    helperName: "isKillIntegrationSync",
    helper: isKillIntegrationSync,
    subsystem: "integration_sync",
    ownerArea: "integrations-platform",
    defaultState: "off",
    failClosed: true,
    publicExposure: "private",
    accessibleUiState: killSwitchAccessibleState("integration_sync"),
    telemetry: killSwitchOperationalTelemetry("integration_sync"),
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/security/kill-switches.test.ts", "src/app/api/integrations/refresh-tokens/route.test.ts"],
  },
];

export type OperationalRolloutSafetyCaseId =
  | "default-off"
  | "default-on"
  | "partial-rollout"
  | "org-allowlist"
  | "workspace-mode"
  | "stale-calibration";

export type OperationalRolloutGuardrailId =
  | "auth"
  | "tenant-scope"
  | "billing-state"
  | "workspace-mode";

export type OperationalRolloutSafetyCase = {
  id: OperationalRolloutSafetyCaseId;
  ownerArea: string;
  objective: string;
  guardrails: readonly OperationalRolloutGuardrailId[];
  validationCommand: "test:operational-feature-flags";
  testRefs: readonly string[];
};

const ALL_ROLLOUT_GUARDRAILS: readonly OperationalRolloutGuardrailId[] = [
  "auth",
  "tenant-scope",
  "billing-state",
  "workspace-mode",
];

export const OPERATIONAL_ROLLOUT_SAFETY_CASES: readonly OperationalRolloutSafetyCase[] = [
  {
    id: "default-off",
    ownerArea: "platform-feature-flags",
    objective: "Unset or explicitly disabled flags remain unavailable until an owned enablement condition is present.",
    guardrails: ALL_ROLLOUT_GUARDRAILS,
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  {
    id: "default-on",
    ownerArea: "platform-feature-flags",
    objective: "Default-on flags still pass auth, tenant, billing, and workspace-mode gates before use.",
    guardrails: ALL_ROLLOUT_GUARDRAILS,
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/feature-flags.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  {
    id: "partial-rollout",
    ownerArea: "platform-feature-flags",
    objective: "Percentage rollout is deterministic and cannot skip tenant or workspace eligibility.",
    guardrails: ALL_ROLLOUT_GUARDRAILS,
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/mutation-rollout.test.ts", "src/lib/operational-feature-flags.test.ts"],
  },
  {
    id: "org-allowlist",
    ownerArea: "platform-feature-flags",
    objective: "Organization allowlists require an authenticated tenant-scoped organization match.",
    guardrails: ALL_ROLLOUT_GUARDRAILS,
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/operational-feature-flags.test.ts"],
  },
  {
    id: "workspace-mode",
    ownerArea: "product-surface",
    objective: "Workspace-mode rollout is evaluated after the product-surface eligibility guard.",
    guardrails: ALL_ROLLOUT_GUARDRAILS,
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/operational-feature-flags.test.ts"],
  },
  {
    id: "stale-calibration",
    ownerArea: "onboarding-platform",
    objective: "Stale calibration blocks rollout even when the base flag condition is enabled.",
    guardrails: ALL_ROLLOUT_GUARDRAILS,
    validationCommand: "test:operational-feature-flags",
    testRefs: ["src/lib/operational-feature-flags.test.ts"],
  },
];

export type EvaluateOperationalRolloutSafetyInput = {
  caseId: OperationalRolloutSafetyCaseId;
  authenticated: boolean;
  tenantScoped: boolean;
  billingAllowed: boolean;
  workspaceModeAllowed: boolean;
  staleCalibration?: boolean;
  killSwitchActive?: boolean;
  enabledByDefault?: boolean;
  explicitlyEnabled?: boolean;
  rolloutPercent?: number;
  rolloutBucket?: number;
  orgId?: string | null;
  orgAllowlist?: readonly string[];
};

export type EvaluateOperationalRolloutSafetyResult = {
  allowed: boolean;
  reason: string;
  blockedGuardrail?: OperationalRolloutGuardrailId | "kill-switch" | "stale-calibration" | "rollout-condition";
  guardrailsApplied: readonly OperationalRolloutGuardrailId[];
};

function block(
  reason: string,
  blockedGuardrail: EvaluateOperationalRolloutSafetyResult["blockedGuardrail"]
): EvaluateOperationalRolloutSafetyResult {
  return {
    allowed: false,
    reason,
    blockedGuardrail,
    guardrailsApplied: ALL_ROLLOUT_GUARDRAILS,
  };
}

export function evaluateOperationalRolloutSafety(
  input: EvaluateOperationalRolloutSafetyInput
): EvaluateOperationalRolloutSafetyResult {
  if (!input.authenticated) return block("auth_required", "auth");
  if (!input.tenantScoped) return block("tenant_scope_required", "tenant-scope");
  if (!input.billingAllowed) return block("billing_state_required", "billing-state");
  if (!input.workspaceModeAllowed) return block("workspace_mode_ineligible", "workspace-mode");
  if (input.killSwitchActive === true) return block("kill_switch_active", "kill-switch");
  if (input.staleCalibration === true) return block("stale_calibration", "stale-calibration");

  switch (input.caseId) {
    case "default-off":
      return input.explicitlyEnabled === true
        ? { allowed: true, reason: "enabled", guardrailsApplied: ALL_ROLLOUT_GUARDRAILS }
        : block("default_off", "rollout-condition");
    case "default-on":
      return input.enabledByDefault === false
        ? block("default_disabled", "rollout-condition")
        : { allowed: true, reason: "enabled", guardrailsApplied: ALL_ROLLOUT_GUARDRAILS };
    case "partial-rollout": {
      const percent = Math.min(100, Math.max(0, Math.floor(input.rolloutPercent ?? 0)));
      const bucket = Math.min(99, Math.max(0, Math.floor(input.rolloutBucket ?? 100)));
      return bucket < percent
        ? { allowed: true, reason: "enabled", guardrailsApplied: ALL_ROLLOUT_GUARDRAILS }
        : block("outside_rollout_bucket", "rollout-condition");
    }
    case "org-allowlist":
      return input.orgId && input.orgAllowlist?.includes(input.orgId)
        ? { allowed: true, reason: "enabled", guardrailsApplied: ALL_ROLLOUT_GUARDRAILS }
        : block("organization_not_allowlisted", "rollout-condition");
    case "workspace-mode":
    case "stale-calibration":
      return { allowed: true, reason: "enabled", guardrailsApplied: ALL_ROLLOUT_GUARDRAILS };
  }
}
