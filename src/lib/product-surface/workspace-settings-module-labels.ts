import type { WorkspaceRole } from "@/lib/navigation";
import { displayLabelForFeature } from "@/lib/product-surface/feature-registry";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  UtilityModuleKey,
} from "@/lib/product-surface/types";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
  ALL_UTILITY_MODULE_KEYS,
  WORKSPACE_NAV_ROLE_ORDER,
} from "@/lib/product-surface/workspace-module-keys";

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  ops_manager: "Ops manager",
  legal_reviewer: "Legal reviewer",
  finance_reviewer: "Finance reviewer",
  manager: "Manager",
};

const ADVANCED_MODULE_FEATURE_BY_KEY: Record<AdvancedNavModuleKey, Parameters<typeof displayLabelForFeature>[0]> = {
  decisions: "decisions",
  campaigns: "campaigns",
  programs: "programs",
  relationships: "relationship_workspaces",
  analytics: "advanced_analytics",
  maintenance: "maintenance",
  collaboration: "collaboration",
  compare_views: "compare_views",
};

const ASSURANCE_MODULE_FEATURE_BY_KEY: Record<AssuranceNavModuleKey, Parameters<typeof displayLabelForFeature>[0]> = {
  findings: "findings",
  control_policies: "control_policies",
  scorecards: "scorecards",
  playbooks: "playbooks",
  autopilot: "autopilot",
  review_boards: "review_boards",
  segments: "segments",
  program_evolution: "program_evolution",
  health_graph: "health_graph",
  outcome_intelligence: "outcome_intelligence",
};

const UTILITY_MODULE_FEATURE_BY_KEY: Record<UtilityModuleKey, Parameters<typeof displayLabelForFeature>[0]> = {
  intake: "intake",
  data_quality: "data_quality",
  review_cadence: "review_cadence",
  watchlists: "watchlists",
  execution_graph: "execution_graph",
  approval_workload: "approval_workload",
  approval_sla_simulator: "approval_sla_simulator",
  more_tools: "more_tools",
};

function advancedModuleLabel(key: AdvancedNavModuleKey): string {
  if (key === "decisions") return displayLabelForFeature("decisions");
  return displayLabelForFeature(ADVANCED_MODULE_FEATURE_BY_KEY[key]);
}

function assuranceModuleLabel(key: AssuranceNavModuleKey): string {
  if (key === "findings") return displayLabelForFeature("findings");
  return displayLabelForFeature(ASSURANCE_MODULE_FEATURE_BY_KEY[key]);
}

function utilityModuleLabel(key: UtilityModuleKey): string {
  if (key === "intake") return displayLabelForFeature("intake");
  return displayLabelForFeature(UTILITY_MODULE_FEATURE_BY_KEY[key]);
}

export const ADVANCED_NAV_ROLE_OPTIONS: { role: WorkspaceRole; label: string }[] =
  WORKSPACE_NAV_ROLE_ORDER.map((role) => ({ role, label: ROLE_LABELS[role] }));

export const WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS: {
  key: AdvancedNavModuleKey;
  label: string;
}[] = ALL_ADVANCED_NAV_MODULE_KEYS.map((key) => ({
  key,
  label: advancedModuleLabel(key),
}));

export const WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS: {
  key: AssuranceNavModuleKey;
  label: string;
}[] = ALL_ASSURANCE_NAV_MODULE_KEYS.map((key) => ({
  key,
  label: assuranceModuleLabel(key),
}));

export const WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS: { key: UtilityModuleKey; label: string }[] =
  ALL_UTILITY_MODULE_KEYS.map((key) => ({
    key,
    label:
      key === "more_tools"
        ? `${utilityModuleLabel(key)} index`
        : utilityModuleLabel(key),
  }));
