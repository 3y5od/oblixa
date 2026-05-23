import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  WorkspaceProductMode,
} from "@/lib/product-surface/types";
import type { WorkspaceRole } from "@/lib/navigation";
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { V10_CORE_REPORT_FAMILIES } from "@/lib/v10-release-contract";

export type FeatureState = "primary" | "secondary" | "hidden" | "admin_only" | "disabled";
export type FeatureLifecycle =
  | "active"
  | "contained"
  | "experimental"
  | "admin_only"
  | "retired_visible"
  | "retired_hidden";

export type V8FeatureDiscoverability = "normal" | "deep_link_only" | "hidden";
export type V8AdminRevealPolicy = "none" | "admin_only";

export type FeatureFamilyKey =
  | "contracts"
  | "review"
  | "work"
  | "renewals"
  | "exceptions"
  | "evidence"
  | "reports"
  | "settings"
  | "programs"
  | "decisions"
  | "campaigns"
  | "relationship_workspaces"
  | "advanced_analytics"
  | "maintenance"
  | "collaboration"
  | "compare_views"
  | "control_policies"
  | "findings"
  | "scorecards"
  | "playbooks"
  | "autopilot"
  | "review_boards"
  | "segments"
  | "program_evolution"
  | "health_graph"
  | "outcome_intelligence"
  | "intake"
  | "data_quality"
  | "review_cadence"
  | "watchlists"
  | "execution_graph"
  | "approval_workload"
  | "approval_sla_simulator"
  | "more_tools";

export type ProductFeatureDef = {
  key: FeatureFamilyKey;
  label: string;
  parentDomain: "core" | "advanced" | "assurance" | "utility";
  minWorkspaceMode: WorkspaceProductMode;
  defaultFeatureState: FeatureState;
  lifecycle: FeatureLifecycle;
  topLevelNavAllowed: boolean;
  globalSearchAllowed: boolean;
  notificationsAllowed: boolean;
  dashboardPromotionAllowed: boolean;
  badgeCountsAllowed: boolean;
  contextualEntryAllowed: boolean;
  deepLinkAllowed: boolean;
  adminRevealAllowed: boolean;
  v8Discoverability?: V8FeatureDiscoverability;
  v8AdminRevealPolicy?: V8AdminRevealPolicy;
  /** Optional explicit mappings; falls back to route/api prefixes and label-derived defaults. */
  owningPagePatterns?: string[];
  owningApiPrefixes?: string[];
  owningActionIds?: string[];
  commandVocabulary?: string[];
  searchVocabulary?: string[];
  featureFlagsAnyOf?: FeatureFlagKey[];
  advancedModuleKey?: AdvancedNavModuleKey;
  assuranceModuleKey?: AssuranceNavModuleKey;
  routePrefixes: string[];
  apiPrefixes: string[];
};

export type SearchIndexClassDef = {
  key:
    | "contracts"
    | "tasks"
    | "obligations"
    | "approvals"
    | "renewals"
    | "exceptions"
    | "evidence"
    | "reports"
    | "decisions"
    | "campaigns"
    | "programs"
    | "relationship_workspaces"
    | "findings"
    | "control_policies"
    | "scorecards"
    | "playbooks"
    | "review_boards"
    | "segments"
    | "program_evolution";
  label: string;
  featureFamily: FeatureFamilyKey;
  minWorkspaceMode: WorkspaceProductMode;
  minRole: WorkspaceRole;
  globalSearch: boolean;
  domainOnlySearch: boolean;
};

export type ReportTypeMapEntry = {
  reportType: string;
  featureFamily: FeatureFamilyKey;
  minWorkspaceMode: WorkspaceProductMode;
};

export type ReportHashMapEntry = {
  hash: string;
  featureFamily: FeatureFamilyKey;
  minWorkspaceMode: WorkspaceProductMode;
};

const CORE_DEF = {
  parentDomain: "core",
  minWorkspaceMode: "core",
  defaultFeatureState: "primary",
  lifecycle: "active",
  topLevelNavAllowed: true,
  globalSearchAllowed: true,
  notificationsAllowed: true,
  dashboardPromotionAllowed: true,
  badgeCountsAllowed: true,
  contextualEntryAllowed: true,
  deepLinkAllowed: true,
  adminRevealAllowed: false,
} as const satisfies Omit<ProductFeatureDef, "key" | "label" | "routePrefixes" | "apiPrefixes">;

const ADV_DEF = {
  parentDomain: "advanced",
  minWorkspaceMode: "advanced",
  defaultFeatureState: "secondary",
  lifecycle: "contained",
  topLevelNavAllowed: true,
  globalSearchAllowed: true,
  notificationsAllowed: true,
  dashboardPromotionAllowed: true,
  badgeCountsAllowed: true,
  contextualEntryAllowed: true,
  deepLinkAllowed: true,
  adminRevealAllowed: true,
} as const satisfies Omit<ProductFeatureDef, "key" | "label" | "routePrefixes" | "apiPrefixes">;

const ASM_DEF = {
  parentDomain: "assurance",
  minWorkspaceMode: "assurance",
  defaultFeatureState: "secondary",
  lifecycle: "contained",
  topLevelNavAllowed: false,
  globalSearchAllowed: true,
  notificationsAllowed: true,
  dashboardPromotionAllowed: true,
  badgeCountsAllowed: true,
  contextualEntryAllowed: true,
  deepLinkAllowed: true,
  adminRevealAllowed: true,
} as const satisfies Omit<ProductFeatureDef, "key" | "label" | "routePrefixes" | "apiPrefixes">;

const UTL_DEF = {
  parentDomain: "utility",
  minWorkspaceMode: "core",
  defaultFeatureState: "secondary",
  lifecycle: "contained",
  topLevelNavAllowed: false,
  globalSearchAllowed: false,
  notificationsAllowed: false,
  dashboardPromotionAllowed: false,
  badgeCountsAllowed: false,
  contextualEntryAllowed: true,
  deepLinkAllowed: true,
  adminRevealAllowed: true,
} as const satisfies Omit<ProductFeatureDef, "key" | "label" | "routePrefixes" | "apiPrefixes">;

export const PRODUCT_FEATURE_REGISTRY: ProductFeatureDef[] = [
  {
    key: "contracts",
    label: "Contracts",
    ...CORE_DEF,
    routePrefixes: ["/contracts"],
    apiPrefixes: ["/contracts", "/command-palette/contracts"],
  },
  { key: "review", label: "Review", ...CORE_DEF, routePrefixes: ["/contracts/review"], apiPrefixes: [] },
  { key: "work", label: "Work", ...CORE_DEF, routePrefixes: ["/work", "/contracts/tasks", "/contracts/obligations", "/contracts/approvals"], apiPrefixes: ["/tasks", "/approvals"] },
  { key: "renewals", label: "Renewals", ...CORE_DEF, routePrefixes: ["/contracts/renewals"], apiPrefixes: ["/renewals", "/export/renewals"] },
  { key: "exceptions", label: "Exceptions", ...CORE_DEF, routePrefixes: ["/contracts/exceptions"], apiPrefixes: ["/exceptions"] },
  {
    key: "evidence",
    label: "Evidence",
    ...CORE_DEF,
    defaultFeatureState: "secondary",
    topLevelNavAllowed: false,
    dashboardPromotionAllowed: false,
    routePrefixes: ["/contracts/evidence-studio"],
    apiPrefixes: ["/evidence", "/evidence/export", "/attestations"],
  },
  {
    key: "reports",
    label: "Reports",
    ...CORE_DEF,
    routePrefixes: ["/reports", "/contracts/reports"],
    apiPrefixes: ["/reports", "/report-packs", "/report-runs", "/export/contracts", "/export/review-packet", "/export/calendar"],
  },
  {
    key: "settings",
    label: "Settings",
    ...CORE_DEF,
    routePrefixes: ["/settings", "/onboarding/calibration"],
    apiPrefixes: [
      "/workspace",
      "/policy",
      "/events",
      "/integrations",
      "/command-centers",
      "/templates",
      "/me",
      "/settings",
    ],
  },

  { key: "programs", label: "Programs", ...ADV_DEF, advancedModuleKey: "programs", featureFlagsAnyOf: ["v5PortfolioCampaigns"], routePrefixes: ["/contracts/programs"], apiPrefixes: ["/programs"] },
  { key: "decisions", label: "Decisions", ...ADV_DEF, advancedModuleKey: "decisions", featureFlagsAnyOf: ["v5DecisionFoundation"], routePrefixes: ["/decisions"], apiPrefixes: ["/decisions"] },
  { key: "campaigns", label: "Campaigns", ...ADV_DEF, advancedModuleKey: "campaigns", featureFlagsAnyOf: ["v5PortfolioCampaigns"], routePrefixes: ["/campaigns"], apiPrefixes: ["/campaigns"] },
  { key: "relationship_workspaces", label: "Relationship workspaces", ...ADV_DEF, advancedModuleKey: "relationships", featureFlagsAnyOf: ["v5RelationshipLayer"], routePrefixes: ["/relationship-workspaces", "/accounts", "/counterparties"], apiPrefixes: ["/accounts", "/counterparties"] },
  {
    key: "advanced_analytics",
    label: "Advanced Analytics",
    ...ADV_DEF,
    advancedModuleKey: "analytics",
    featureFlagsAnyOf: ["v5SimulationAndIntelligence"],
    routePrefixes: ["/contracts/analytics"],
    apiPrefixes: ["/intelligence", "/capacity", "/simulations"],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    ...ADV_DEF,
    advancedModuleKey: "maintenance",
    routePrefixes: ["/contracts/maintenance"],
    apiPrefixes: ["/maintenance"],
  },
  {
    key: "collaboration",
    label: "Collaboration",
    ...ADV_DEF,
    advancedModuleKey: "collaboration",
    featureFlagsAnyOf: ["v5ExternalCollaboration"],
    routePrefixes: ["/contracts/collaboration"],
    apiPrefixes: ["/external-actions"],
  },
  {
    key: "compare_views",
    label: "Compare Views",
    ...ADV_DEF,
    advancedModuleKey: "compare_views",
    featureFlagsAnyOf: ["v5SimulationAndIntelligence", "v5ControlRoomUx"],
    routePrefixes: ["/decisions/compare", "/campaigns/compare"],
    apiPrefixes: [],
  },

  { key: "control_policies", label: "Control Policies", ...ASM_DEF, assuranceModuleKey: "control_policies", featureFlagsAnyOf: ["v6ControlPolicies"], routePrefixes: ["/assurance/control-policies"], apiPrefixes: ["/control-policies"] },
  { key: "findings", label: "Findings", ...ASM_DEF, assuranceModuleKey: "findings", featureFlagsAnyOf: ["v6AssuranceCore"], routePrefixes: ["/assurance", "/assurance/findings"], apiPrefixes: ["/assurance/findings"] },
  { key: "scorecards", label: "Scorecards", ...ASM_DEF, assuranceModuleKey: "scorecards", featureFlagsAnyOf: ["v6AssuranceCore"], routePrefixes: ["/assurance/scorecards"], apiPrefixes: ["/assurance/scorecards"] },
  { key: "playbooks", label: "Playbooks", ...ASM_DEF, assuranceModuleKey: "playbooks", featureFlagsAnyOf: ["v6AdaptivePlaybooks"], routePrefixes: ["/assurance/playbooks"], apiPrefixes: ["/playbooks"] },
  { key: "autopilot", label: "Autopilot", ...ASM_DEF, assuranceModuleKey: "autopilot", featureFlagsAnyOf: ["v6Autopilot"], routePrefixes: ["/assurance/autopilot"], apiPrefixes: ["/autopilot"] },
  { key: "review_boards", label: "Review Boards", ...ASM_DEF, assuranceModuleKey: "review_boards", featureFlagsAnyOf: ["v6ReviewBoards"], routePrefixes: ["/assurance/review-boards"], apiPrefixes: ["/review-boards"] },
  { key: "segments", label: "Segments", ...ASM_DEF, assuranceModuleKey: "segments", featureFlagsAnyOf: ["v6Segments"], routePrefixes: ["/assurance/segments"], apiPrefixes: ["/segments"] },
  { key: "program_evolution", label: "Program Evolution", ...ASM_DEF, assuranceModuleKey: "program_evolution", featureFlagsAnyOf: ["v6AssuranceCore"], routePrefixes: ["/assurance/program-evolution"], apiPrefixes: ["/program-evolution"] },
  {
    key: "health_graph",
    label: "Health Graph",
    ...ASM_DEF,
    assuranceModuleKey: "health_graph",
    featureFlagsAnyOf: ["v6AssuranceCore"],
    routePrefixes: ["/assurance/health-graph"],
    apiPrefixes: ["/assurance/health-graph"],
  },
  {
    key: "outcome_intelligence",
    label: "Outcome Intelligence",
    ...ASM_DEF,
    assuranceModuleKey: "outcome_intelligence",
    featureFlagsAnyOf: ["v6OutcomeIntelligence"],
    routePrefixes: [],
    apiPrefixes: ["/outcomes"],
  },

  { key: "intake", label: "Intake", ...UTL_DEF, routePrefixes: ["/contracts/intake"], apiPrefixes: ["/import"] },
  { key: "data_quality", label: "Data Quality", ...UTL_DEF, routePrefixes: ["/contracts/data-quality"], apiPrefixes: ["/extract"] },
  { key: "review_cadence", label: "Review Cadence", ...UTL_DEF, routePrefixes: ["/contracts/review-cadence"], apiPrefixes: [] },
  { key: "watchlists", label: "Watchlists", ...UTL_DEF, routePrefixes: ["/contracts/watchlists"], apiPrefixes: [] },
  { key: "execution_graph", label: "Execution Graph", ...UTL_DEF, routePrefixes: ["/contracts/execution-graph"], apiPrefixes: [] },
  { key: "approval_workload", label: "Approval Workload", ...UTL_DEF, routePrefixes: ["/contracts/approvals/workload"], apiPrefixes: [] },
  { key: "approval_sla_simulator", label: "Approval SLA Simulator", ...UTL_DEF, routePrefixes: ["/contracts/approvals/sla-simulator"], apiPrefixes: ["/approvals/sla-metrics"] },
  { key: "more_tools", label: "Tools", ...UTL_DEF, routePrefixes: ["/more"], apiPrefixes: [] },
];

export const SEARCH_INDEX_CLASSES: SearchIndexClassDef[] = [
  { key: "contracts", label: "Contracts", featureFamily: "contracts", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "tasks", label: "Tasks", featureFamily: "work", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "obligations", label: "Obligations", featureFamily: "work", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "approvals", label: "Approvals", featureFamily: "work", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "renewals", label: "Renewals", featureFamily: "renewals", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "exceptions", label: "Exceptions", featureFamily: "exceptions", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "evidence", label: "Evidence", featureFamily: "evidence", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "reports", label: "Reports", featureFamily: "reports", minWorkspaceMode: "core", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "decisions", label: "Decisions", featureFamily: "decisions", minWorkspaceMode: "advanced", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "campaigns", label: "Campaigns", featureFamily: "campaigns", minWorkspaceMode: "advanced", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "programs", label: "Programs", featureFamily: "programs", minWorkspaceMode: "advanced", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "relationship_workspaces", label: "Relationship workspaces", featureFamily: "relationship_workspaces", minWorkspaceMode: "advanced", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "findings", label: "Findings", featureFamily: "findings", minWorkspaceMode: "assurance", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "control_policies", label: "Control Policies", featureFamily: "control_policies", minWorkspaceMode: "assurance", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "scorecards", label: "Scorecards", featureFamily: "scorecards", minWorkspaceMode: "assurance", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "playbooks", label: "Playbooks", featureFamily: "playbooks", minWorkspaceMode: "assurance", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "review_boards", label: "Review Boards", featureFamily: "review_boards", minWorkspaceMode: "assurance", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "segments", label: "Segments", featureFamily: "segments", minWorkspaceMode: "assurance", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
  { key: "program_evolution", label: "Program Evolution", featureFamily: "program_evolution", minWorkspaceMode: "assurance", minRole: "viewer", globalSearch: true, domainOnlySearch: false },
];

export const REPORT_TYPE_MAP: ReportTypeMapEntry[] = [
  { reportType: "monthly_renewal_readiness", featureFamily: "renewals", minWorkspaceMode: "core" },
  { reportType: "exception_summary", featureFamily: "exceptions", minWorkspaceMode: "core" },
  { reportType: "approvals_sla", featureFamily: "work", minWorkspaceMode: "core" },
  { reportType: "obligation_overview", featureFamily: "work", minWorkspaceMode: "core" },
  { reportType: "decision_queue_summary", featureFamily: "decisions", minWorkspaceMode: "advanced" },
  { reportType: "campaign_progress_summary", featureFamily: "campaigns", minWorkspaceMode: "advanced" },
  { reportType: "relationship_workspace_summary", featureFamily: "relationship_workspaces", minWorkspaceMode: "advanced" },
  { reportType: "advanced_compare_outputs", featureFamily: "compare_views", minWorkspaceMode: "advanced" },
  { reportType: "findings_summary", featureFamily: "findings", minWorkspaceMode: "assurance" },
  { reportType: "policy_compliance_summary", featureFamily: "control_policies", minWorkspaceMode: "assurance" },
  { reportType: "scorecard_summary", featureFamily: "scorecards", minWorkspaceMode: "assurance" },
  { reportType: "playbook_effectiveness_summary", featureFamily: "playbooks", minWorkspaceMode: "assurance" },
  { reportType: "review_board_packet", featureFamily: "review_boards", minWorkspaceMode: "assurance" },
  { reportType: "outcome_intelligence_summary", featureFamily: "outcome_intelligence", minWorkspaceMode: "assurance" },
];

export const REPORT_HASH_MAP: ReportHashMapEntry[] = [
  { hash: "portfolio-signals", featureFamily: "advanced_analytics", minWorkspaceMode: "advanced" },
  { hash: "portfolio-analytics", featureFamily: "advanced_analytics", minWorkspaceMode: "advanced" },
  { hash: "campaign-drift", featureFamily: "campaigns", minWorkspaceMode: "advanced" },
  { hash: "capacity-forecasts", featureFamily: "advanced_analytics", minWorkspaceMode: "advanced" },
  { hash: "assurance-analytics", featureFamily: "findings", minWorkspaceMode: "assurance" },
  { hash: "outcome-intelligence", featureFamily: "outcome_intelligence", minWorkspaceMode: "assurance" },
];

const MODE_RANK: Record<WorkspaceProductMode, number> = {
  core: 0,
  advanced: 1,
  assurance: 2,
};

export function workspaceModeAtLeast(
  mode: WorkspaceProductMode,
  min: WorkspaceProductMode
): boolean {
  return MODE_RANK[mode] >= MODE_RANK[min];
}

export function featureRegistryByKey(): Map<FeatureFamilyKey, ProductFeatureDef> {
  return new Map(PRODUCT_FEATURE_REGISTRY.map((row) => [row.key, row]));
}

export function v8DiscoverabilityForFeature(def: ProductFeatureDef): V8FeatureDiscoverability {
  if (def.v8Discoverability) return def.v8Discoverability;
  if (def.lifecycle === "retired_hidden" || def.defaultFeatureState === "disabled") return "hidden";
  if (!def.contextualEntryAllowed && def.deepLinkAllowed) return "deep_link_only";
  return "normal";
}

export function v8AdminRevealPolicyForFeature(def: ProductFeatureDef): V8AdminRevealPolicy {
  if (def.v8AdminRevealPolicy) return def.v8AdminRevealPolicy;
  return def.adminRevealAllowed ? "admin_only" : "none";
}

export function v8OwningPagePatternsForFeature(def: ProductFeatureDef): string[] {
  if (def.owningPagePatterns?.length) return [...new Set(def.owningPagePatterns)];
  return [...new Set(def.routePrefixes)];
}

export function v8OwningApiPrefixesForFeature(def: ProductFeatureDef): string[] {
  if (def.owningApiPrefixes?.length) return [...new Set(def.owningApiPrefixes)];
  return [...new Set(def.apiPrefixes)];
}

export function v8OwningActionIdsForFeature(def: ProductFeatureDef): string[] {
  if (def.owningActionIds?.length) return [...new Set(def.owningActionIds)];
  return [];
}

export function v8CommandVocabularyForFeature(def: ProductFeatureDef): string[] {
  if (def.commandVocabulary?.length) return [...new Set(def.commandVocabulary)];
  return [def.label.toLowerCase(), def.key.replaceAll("_", " ")];
}

export function v8SearchVocabularyForFeature(def: ProductFeatureDef): string[] {
  if (def.searchVocabulary?.length) return [...new Set(def.searchVocabulary)];
  return [def.label.toLowerCase(), def.key.replaceAll("_", " ")];
}

const FEATURE_LABEL_BY_KEY = new Map(PRODUCT_FEATURE_REGISTRY.map((row) => [row.key, row.label] as const));

export function displayLabelForFeature(featureKey: FeatureFamilyKey): string {
  return FEATURE_LABEL_BY_KEY.get(featureKey) ?? featureKey;
}

function normalizePath(pathname: string): string {
  const p = pathname.split("?")[0] ?? pathname;
  return p.split("#")[0] ?? p;
}

export function minWorkspaceModeForRegistryPath(pathname: string): WorkspaceProductMode | null {
  const p = normalizePath(pathname);
  if (!p.startsWith("/")) return null;
  let best: { len: number; mode: WorkspaceProductMode } | null = null;
  for (const row of PRODUCT_FEATURE_REGISTRY) {
    for (const prefix of row.routePrefixes) {
      if (p === prefix || p.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.len) {
          best = { len: prefix.length, mode: row.minWorkspaceMode };
        }
      }
    }
  }
  return best?.mode ?? null;
}

export function featureFamilyForPath(pathname: string): FeatureFamilyKey | null {
  const p = normalizePath(pathname);
  if (!p.startsWith("/")) return null;
  let best: { len: number; key: FeatureFamilyKey } | null = null;
  for (const row of PRODUCT_FEATURE_REGISTRY) {
    for (const prefix of row.routePrefixes) {
      if (p === prefix || p.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.len) {
          best = { len: prefix.length, key: row.key };
        }
      }
    }
  }
  return best?.key ?? null;
}

export function featureFamilyForApiPath(pathname: string): FeatureFamilyKey | null {
  const p = normalizePath(pathname);
  const apiPath = p.startsWith("/api/") ? p.slice(4) : p;
  if (!apiPath.startsWith("/")) return null;
  let best: { len: number; key: FeatureFamilyKey } | null = null;
  for (const row of PRODUCT_FEATURE_REGISTRY) {
    for (const prefix of row.apiPrefixes) {
      if (apiPath === prefix || apiPath.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.len) {
          best = { len: prefix.length, key: row.key };
        }
      }
    }
  }
  return best?.key ?? null;
}

const SEARCH_INDEX_CLASS_BY_KEY = new Map(SEARCH_INDEX_CLASSES.map((row) => [row.key, row] as const));

function registeredFeatureFamilyKey(value: unknown): FeatureFamilyKey | null {
  const key = typeof value === "string" && value.trim() ? (value.trim() as FeatureFamilyKey) : null;
  if (!key) return null;
  return featureRegistryByKey().has(key) ? key : null;
}

export function resolveSearchIndexFeatureFamily(input: {
  featureFamily?: unknown;
  moduleKey?: unknown;
  href?: unknown;
}): FeatureFamilyKey {
  const storedFamily = registeredFeatureFamilyKey(input.featureFamily);
  if (storedFamily) return storedFamily;
  const moduleFamily = registeredFeatureFamilyKey(input.moduleKey);
  if (moduleFamily) return moduleFamily;
  const moduleKey = typeof input.moduleKey === "string" ? input.moduleKey.trim() : "";
  if (moduleKey) {
    const classRow = SEARCH_INDEX_CLASS_BY_KEY.get(moduleKey as SearchIndexClassDef["key"]);
    if (classRow) return classRow.featureFamily;
  }
  const href = typeof input.href === "string" ? input.href.trim() : "";
  if (href) {
    const hrefFamily = featureFamilyForPath(href);
    if (hrefFamily) return hrefFamily;
  }
  return "contracts";
}

export function minWorkspaceModeForReportType(reportType: string): WorkspaceProductMode {
  const normalized = reportType.trim().toLowerCase();
  const exact = REPORT_TYPE_MAP.find((row) => row.reportType === normalized);
  if (exact) return exact.minWorkspaceMode;
  if (normalized.includes("finding") || normalized.includes("scorecard") || normalized.includes("playbook")) {
    return "assurance";
  }
  if (normalized.includes("decision") || normalized.includes("campaign") || normalized.includes("relationship")) {
    return "advanced";
  }
  return "core";
}

/** True when the org workspace mode may create, list, or export this report pack type (V7 §14). */
export function workspaceModeAllowsReportType(
  mode: WorkspaceProductMode,
  reportType: string
): boolean {
  return workspaceModeAtLeast(mode, minWorkspaceModeForReportType(reportType));
}

const DEFAULT_REPORT_PACK_TYPES = ["weekly_execution_health", ...V10_CORE_REPORT_FAMILIES] as const;

/** Report types the UI/API should offer for pack creation in this mode (map entries + safe defaults). */
export function eligibleReportTypeOptionsForWorkspaceMode(mode: WorkspaceProductMode): string[] {
  const set = new Set<string>();
  for (const t of DEFAULT_REPORT_PACK_TYPES) {
    if (workspaceModeAllowsReportType(mode, t)) set.add(t);
  }
  for (const row of REPORT_TYPE_MAP) {
    if (workspaceModeAtLeast(mode, row.minWorkspaceMode)) set.add(row.reportType);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function minWorkspaceModeForReportsHash(hash: string): WorkspaceProductMode {
  const normalized = hash.trim().toLowerCase();
  const row = REPORT_HASH_MAP.find((v) => v.hash === normalized);
  return row?.minWorkspaceMode ?? "core";
}
