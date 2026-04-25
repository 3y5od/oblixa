/** Stored in `organizations.v6_org_settings_json` (refinement / product-surface policy). */
export type WorkspaceProductMode = "core" | "advanced" | "assurance";

export type AdvancedNavModuleKey =
  | "decisions"
  | "campaigns"
  | "programs"
  | "relationships"
  | "analytics"
  | "maintenance"
  | "collaboration"
  | "compare_views";
export type AssuranceNavModuleKey =
  | "findings"
  | "control_policies"
  | "scorecards"
  | "playbooks"
  | "autopilot"
  | "review_boards"
  | "segments"
  | "program_evolution"
  | "health_graph"
  | "outcome_intelligence";
export type UtilityModuleKey =
  | "intake"
  | "data_quality"
  | "review_cadence"
  | "watchlists"
  | "execution_graph"
  | "approval_workload"
  | "approval_sla_simulator"
  | "more_tools";
export type ProductSearchScope = "match_mode" | "core_only";

export type NotificationProductTier = "core" | "advanced" | "assurance";
