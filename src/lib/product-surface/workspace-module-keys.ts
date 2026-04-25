import type { WorkspaceRole } from "@/lib/navigation";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  UtilityModuleKey,
} from "@/lib/product-surface/types";

export const ALL_ADVANCED_NAV_MODULE_KEYS = [
  "decisions",
  "campaigns",
  "programs",
  "relationships",
  "analytics",
  "maintenance",
  "collaboration",
  "compare_views",
] as const satisfies readonly AdvancedNavModuleKey[];

export const ALL_ASSURANCE_NAV_MODULE_KEYS = [
  "findings",
  "control_policies",
  "scorecards",
  "playbooks",
  "autopilot",
  "review_boards",
  "segments",
  "program_evolution",
  "health_graph",
  "outcome_intelligence",
] as const satisfies readonly AssuranceNavModuleKey[];

export const ALL_UTILITY_MODULE_KEYS = [
  "intake",
  "data_quality",
  "review_cadence",
  "watchlists",
  "execution_graph",
  "approval_workload",
  "approval_sla_simulator",
  "more_tools",
] as const satisfies readonly UtilityModuleKey[];

export const WORKSPACE_NAV_ROLE_ORDER = [
  "admin",
  "editor",
  "viewer",
  "ops_manager",
  "legal_reviewer",
  "finance_reviewer",
  "manager",
] as const satisfies readonly WorkspaceRole[];

export const WORKSPACE_HOME_SECTION_KEYS = [
  "control_room_strip",
  "telemetry_compact",
  "v6_assurance_snapshot",
  "outcome_intelligence",
  "assurance_signals",
] as const;

const ADVANCED_NAV_MODULE_KEY_SET = new Set<string>(ALL_ADVANCED_NAV_MODULE_KEYS);
const ASSURANCE_NAV_MODULE_KEY_SET = new Set<string>(ALL_ASSURANCE_NAV_MODULE_KEYS);
const UTILITY_MODULE_KEY_SET = new Set<string>(ALL_UTILITY_MODULE_KEYS);
const WORKSPACE_NAV_ROLE_SET = new Set<string>(WORKSPACE_NAV_ROLE_ORDER);

export function isAdvancedNavModuleKey(value: unknown): value is AdvancedNavModuleKey {
  return typeof value === "string" && ADVANCED_NAV_MODULE_KEY_SET.has(value);
}

export function isAssuranceNavModuleKey(value: unknown): value is AssuranceNavModuleKey {
  return typeof value === "string" && ASSURANCE_NAV_MODULE_KEY_SET.has(value);
}

export function isUtilityModuleKey(value: unknown): value is UtilityModuleKey {
  return typeof value === "string" && UTILITY_MODULE_KEY_SET.has(value);
}

export function isWorkspaceNavRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && WORKSPACE_NAV_ROLE_SET.has(value);
}

