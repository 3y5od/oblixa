import type { WorkspaceRole } from "@/lib/navigation";
import { displayLabelForFeature } from "@/lib/product-surface/feature-registry";
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  UtilityModuleKey,
} from "@/lib/product-surface/types";

export const ADVANCED_NAV_ROLE_OPTIONS: { role: WorkspaceRole; label: string }[] = [
  { role: "admin", label: "Admin" },
  { role: "editor", label: "Editor" },
  { role: "viewer", label: "Viewer" },
  { role: "ops_manager", label: "Ops manager" },
  { role: "legal_reviewer", label: "Legal reviewer" },
  { role: "finance_reviewer", label: "Finance reviewer" },
  { role: "manager", label: "Manager" },
];

export const WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS: {
  key: AdvancedNavModuleKey;
  label: string;
}[] = [
  { key: "decisions", label: displayLabelForFeature("decisions") },
  { key: "campaigns", label: displayLabelForFeature("campaigns") },
  { key: "programs", label: displayLabelForFeature("programs") },
  { key: "relationships", label: displayLabelForFeature("relationship_workspaces") },
  { key: "analytics", label: displayLabelForFeature("advanced_analytics") },
  { key: "maintenance", label: displayLabelForFeature("maintenance") },
  { key: "collaboration", label: displayLabelForFeature("collaboration") },
  { key: "compare_views", label: displayLabelForFeature("compare_views") },
];

export const WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS: {
  key: AssuranceNavModuleKey;
  label: string;
}[] = [
  { key: "findings", label: displayLabelForFeature("findings") },
  { key: "control_policies", label: displayLabelForFeature("control_policies") },
  { key: "scorecards", label: displayLabelForFeature("scorecards") },
  { key: "playbooks", label: displayLabelForFeature("playbooks") },
  { key: "autopilot", label: displayLabelForFeature("autopilot") },
  { key: "review_boards", label: displayLabelForFeature("review_boards") },
  { key: "segments", label: displayLabelForFeature("segments") },
  { key: "program_evolution", label: displayLabelForFeature("program_evolution") },
  { key: "health_graph", label: displayLabelForFeature("health_graph") },
  { key: "outcome_intelligence", label: displayLabelForFeature("outcome_intelligence") },
];

export const WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS: { key: UtilityModuleKey; label: string }[] =
  [
    { key: "intake", label: displayLabelForFeature("intake") },
    { key: "data_quality", label: displayLabelForFeature("data_quality") },
    { key: "review_cadence", label: displayLabelForFeature("review_cadence") },
    { key: "watchlists", label: displayLabelForFeature("watchlists") },
    { key: "execution_graph", label: displayLabelForFeature("execution_graph") },
    { key: "approval_workload", label: displayLabelForFeature("approval_workload") },
    { key: "approval_sla_simulator", label: displayLabelForFeature("approval_sla_simulator") },
    { key: "more_tools", label: `${displayLabelForFeature("more_tools")} index` },
  ];
