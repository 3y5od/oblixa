/**
 * Deterministic onboarding scoring and V6 patch builder (onboarding spec §7, §11–§13, §19.3).
 *
 * §1–2: Calibrates visible complexity only; admins override via V6 + product settings (reversible).
 * §11 / §24: `scoreAdvancedSignals` and `scoreAssuranceSignals` encode contribution increments; see also
 * `calibration-dimensions.ts` for explicit four-dimension decomposition. Tie-break: lower mode / fewer families.
 */
import type { FeatureFlagKey } from "@/lib/feature-flags";
import { HOME_SECTION_IDS } from "@/lib/product-surface/resolver";
import { isValidDefaultLandingPath } from "@/lib/product-surface/landing-eligibility";
import type { AdvancedNavModuleKey, AssuranceNavModuleKey, UtilityModuleKey, WorkspaceProductMode } from "@/lib/product-surface/types";
import {
  ALL_ADVANCED_NAV_MODULE_KEYS,
  ALL_ASSURANCE_NAV_MODULE_KEYS,
} from "@/lib/product-surface/workspace-module-keys";
import type { V6OrgSettingsMergePatch } from "@/lib/assurance/org-settings";
import type {
  CalibrationAnswersOptional,
  CalibrationAnswersRequired,
  CalibrationRecommendation,
} from "@/lib/onboarding/calibration-types";

export function scoreAdvancedSignals(a: CalibrationAnswersRequired): number {
  let s = 0;
  if (a.primary_use_case === "coordinate_renewals_decisions") s += 3;
  if (a.primary_use_case === "tasks_approvals_obligations") s += 1;
  if (a.primary_use_case === "assurance_control_workflows") s += 2;
  if (a.team_model === "medium_6_20") s += 1;
  if (a.team_model === "large_cross_functional") s += 2;
  if (a.workflow_maturity === "somewhat_structured") s += 1;
  if (a.workflow_maturity === "well_defined_cross_team") s += 2;
  if (a.workflow_maturity === "highly_structured_policy") s += 2;
  if (a.main_pain === "decisions_handoffs") s += 2;
  if (a.main_pain === "risk_drift_control") s += 1;
  if (a.complexity_preference === "more_if_helps") s += 1;
  if (a.complexity_preference === "comfortable_advanced") s += 2;
  if (a.complexity_preference === "full_visibility") s += 3;
  if (a.setup_intent === "configure_workflows_advanced") s += 2;
  return s;
}

export function scoreAssuranceSignals(a: CalibrationAnswersRequired): number {
  let s = 0;
  if (a.assurance_intent === "yes_workspace") s += 6;
  if (a.main_pain === "risk_drift_control") s += 3;
  if (a.workflow_maturity === "highly_structured_policy") s += 2;
  if (a.primary_use_case === "assurance_control_workflows") s += 4;
  return s;
}

function complexityCeiling(
  c: CalibrationAnswersRequired["complexity_preference"]
): WorkspaceProductMode {
  if (c === "simplest") return "core";
  if (c === "more_if_helps") return "advanced";
  return "assurance";
}

export function resolveWorkspaceMode(a: CalibrationAnswersRequired): WorkspaceProductMode {
  const ceiling = complexityCeiling(a.complexity_preference);
  const adv = scoreAdvancedSignals(a);
  const asm = scoreAssuranceSignals(a);

  let mode: WorkspaceProductMode = "core";
  if (adv >= 5 || a.primary_use_case === "coordinate_renewals_decisions") {
    mode = "advanced";
  }
  if (
    a.assurance_intent === "yes_workspace" &&
    asm >= 8 &&
    (a.workflow_maturity === "highly_structured_policy" ||
      a.primary_use_case === "assurance_control_workflows" ||
      asm >= 11)
  ) {
    mode = "assurance";
  }

  if (ceiling === "core") {
    if (mode === "assurance" || mode === "advanced") {
      if (
        a.assurance_intent === "yes_workspace" &&
        a.primary_use_case === "assurance_control_workflows" &&
        a.workflow_maturity === "highly_structured_policy"
      ) {
        return "advanced";
      }
    }
    return "core";
  }
  if (ceiling === "advanced") {
    if (mode === "assurance") return "advanced";
    return mode === "advanced" ? "advanced" : "core";
  }
  return mode;
}

export function clampModeToFeatureFlags(
  mode: WorkspaceProductMode,
  flags: Record<FeatureFlagKey, boolean>
): WorkspaceProductMode {
  if (mode === "assurance") {
    if (!flags.v6AssuranceCore) {
      return flags.v5DecisionFoundation || flags.v5PortfolioCampaigns || flags.v5RelationshipLayer
        ? "advanced"
        : "core";
    }
  }
  if (mode === "advanced") {
    if (!flags.v5DecisionFoundation && !flags.v5PortfolioCampaigns && !flags.v5RelationshipLayer) {
      return "core";
    }
  }
  return mode;
}

/**
 * §19.3 — drop revealed advanced families that the deployment cannot expose (v5* flags).
 * Call after computing candidate `advanced_modules_hidden` / enabled lists.
 */
export function clampAdvancedFamiliesToFeatureFlags(
  revealed: AdvancedNavModuleKey[],
  flags: Record<FeatureFlagKey, boolean>
): AdvancedNavModuleKey[] {
  return revealed.filter((k) => {
    if (k === "decisions") return flags.v5DecisionFoundation;
    if (k === "campaigns" || k === "programs") return flags.v5PortfolioCampaigns;
    if (k === "relationships") return flags.v5RelationshipLayer;
    if (k === "compare_views") return flags.v5SimulationAndIntelligence;
    return true;
  });
}

function advancedHiddenForMode(
  mode: WorkspaceProductMode,
  a: CalibrationAnswersRequired,
  flags: Record<FeatureFlagKey, boolean>
): AdvancedNavModuleKey[] {
  if (mode === "core") {
    return [...ALL_ADVANCED_NAV_MODULE_KEYS];
  }

  const hidden = new Set<AdvancedNavModuleKey>(ALL_ADVANCED_NAV_MODULE_KEYS);
  hidden.delete("decisions");

  const strongCoordination =
    a.primary_use_case === "coordinate_renewals_decisions" ||
    a.team_model === "large_cross_functional" ||
    a.team_model === "medium_6_20";
  const strongOps =
    a.setup_intent === "configure_workflows_advanced" ||
    a.complexity_preference === "full_visibility" ||
    a.complexity_preference === "comfortable_advanced";

  if (strongCoordination && a.complexity_preference !== "simplest") {
    if (flags.v5PortfolioCampaigns) {
      hidden.delete("campaigns");
      hidden.delete("programs");
    }
    if (flags.v5RelationshipLayer) hidden.delete("relationships");
  }

  if (a.primary_use_case === "assurance_control_workflows" && mode === "assurance" && flags.v5PortfolioCampaigns) {
    hidden.delete("campaigns");
  }

  if (strongOps) {
    hidden.delete("analytics");
    hidden.delete("maintenance");
    hidden.delete("collaboration");
    if (flags.v5SimulationAndIntelligence) hidden.delete("compare_views");
  }

  if (!flags.v5DecisionFoundation) hidden.add("decisions");
  if (!flags.v5PortfolioCampaigns) {
    hidden.add("campaigns");
    hidden.add("programs");
  }
  if (!flags.v5RelationshipLayer) hidden.add("relationships");

  return ALL_ADVANCED_NAV_MODULE_KEYS.filter((k) => hidden.has(k));
}

function assuranceHiddenForMode(mode: WorkspaceProductMode, a: CalibrationAnswersRequired): AssuranceNavModuleKey[] {
  if (mode !== "assurance") {
    return [...ALL_ASSURANCE_NAV_MODULE_KEYS];
  }
  const visible = new Set<AssuranceNavModuleKey>(["findings", "control_policies"]);
  if (a.main_pain === "risk_drift_control") visible.add("scorecards");
  return ALL_ASSURANCE_NAV_MODULE_KEYS.filter((k) => !visible.has(k));
}

export function utilityHiddenForAnswers(a: CalibrationAnswersRequired): UtilityModuleKey[] {
  const hidden: UtilityModuleKey[] = [
    "execution_graph",
    "approval_sla_simulator",
    "approval_workload",
  ];
  if (a.setup_intent !== "upload_import") hidden.push("intake");
  if (a.complexity_preference === "simplest") {
    hidden.push("data_quality", "review_cadence", "watchlists", "more_tools");
  }
  return hidden;
}

function landingPath(a: CalibrationAnswersRequired, opt?: CalibrationAnswersOptional): string {
  if (opt?.org_role === "legal_ops") return "/contracts/review";
  if (opt?.org_role === "exec") return "/dashboard";
  switch (a.setup_intent) {
    case "upload_import":
      return opt?.import_volume === "high" ? "/contracts/bulk" : "/contracts/new";
    case "review_extracted_fields":
      return "/contracts/review";
    case "organize_work_renewals":
      return "/work";
    case "configure_workflows_advanced":
      return "/settings/product";
    default:
      return "/dashboard";
  }
}

function homeHidden(mode: WorkspaceProductMode): string[] {
  const all = [...HOME_SECTION_IDS];
  if (mode === "core") return all;
  if (mode === "advanced") {
    return ["v6_assurance_snapshot", "outcome_intelligence", "assurance_signals"];
  }
  return ["outcome_intelligence"];
}

function setupChecklist(a: CalibrationAnswersRequired, opt?: CalibrationAnswersOptional): string[] {
  const steps: string[] = [];
  if (opt?.import_volume === "high") {
    steps.push("bulk_import", "upload_contract", "review_fields");
  } else if (a.setup_intent === "upload_import") {
    steps.push("upload_contract", "review_fields");
  } else if (a.setup_intent === "review_extracted_fields") {
    steps.push("review_fields", "upload_contract");
  } else {
    steps.push("organize_work", "upload_contract");
  }
  if (a.setup_intent === "configure_workflows_advanced") {
    steps.push("product_settings");
  }
  // onboarding spec §10.1 — copy/checklist only; does not affect mode scoring.
  if (opt?.industry_emphasis === "regulated" || opt?.industry_emphasis === "professional_services") {
    steps.unshift("compliance_alignment");
  }
  return steps;
}

/** Every id `setupChecklist()` may emit (copy parity, review UI, onboarding banner). */
export const SETUP_CHECKLIST_POSSIBLE_KEYS = [
  "bulk_import",
  "upload_contract",
  "review_fields",
  "organize_work",
  "product_settings",
  "compliance_alignment",
] as const;

export type SetupChecklistStepKey = (typeof SETUP_CHECKLIST_POSSIBLE_KEYS)[number];

export function finalizeRecommendation(
  a: CalibrationAnswersRequired,
  flags: Record<FeatureFlagKey, boolean>,
  opt?: CalibrationAnswersOptional
): CalibrationRecommendation {
  const rawMode = resolveWorkspaceMode(a);
  const mode = clampModeToFeatureFlags(rawMode, flags);
  let path = landingPath(a, opt);
  if (!isValidDefaultLandingPath(path, mode)) path = "/dashboard";

  const advHidden = advancedHiddenForMode(mode, a, flags);
  const asmHidden = assuranceHiddenForMode(mode, a);
  const utilHidden = utilityHiddenForAnswers(a);

  const advancedEnabled = clampAdvancedFamiliesToFeatureFlags(
    ALL_ADVANCED_NAV_MODULE_KEYS.filter((k) => !advHidden.includes(k)),
    flags
  );

  return {
    recommended_workspace_mode: mode,
    recommended_advanced_families_enabled: advancedEnabled,
    recommended_assurance_families_enabled: ALL_ASSURANCE_NAV_MODULE_KEYS.filter((k) => !asmHidden.includes(k)),
    recommended_default_landing_path: path,
    recommended_dashboard_profile: mode === "core" ? "core" : mode === "advanced" ? "advanced" : "assurance_lite",
    recommended_search_scope: mode === "core" ? "core_only" : "match_mode",
    recommended_notification_profile: {
      suppress_advanced_tiers: mode === "core",
    },
    recommended_report_profile: {
      suppress_incompatible_subscriptions: mode === "core",
      aligns_with_workspace_transition: true,
    },
    recommended_setup_checklist: setupChecklist(a, opt),
    recommended_utility_modules_hidden: utilHidden,
  };
}

/** Core-safe answers for error/minimal paths (§4.4 / §22.1) — matches conservative utility hiding. */
const CORE_FALLBACK_ANSWERS: CalibrationAnswersRequired = {
  primary_use_case: "track_contracts_dates",
  team_model: "solo",
  workflow_maturity: "manual_spreadsheet",
  main_pain: "find_contracts_dates",
  complexity_preference: "simplest",
  setup_intent: "upload_import",
  assurance_intent: "not_now",
};

/**
 * Maps a finalized recommendation to a V6 merge patch (onboarding spec §12–§13, §18).
 *
 * **§24.1 — keys this patch must never include** (leave absent so merge preserves prior values):
 * `assurance_nav_admin_testing`, `advanced_nav_roles`, `assurance_nav_roles`,
 * `review_board_notification_emails`, and any keys not listed in the implementation plan.
 * `autopilot_allow_execution` is only ever `false` here (§7.5).
 */
export function recommendationToV6Patch(rec: CalibrationRecommendation): V6OrgSettingsMergePatch {
  const mode = rec.recommended_workspace_mode;
  const advHidden = ALL_ADVANCED_NAV_MODULE_KEYS.filter((k) => !rec.recommended_advanced_families_enabled.includes(k));
  const asmHidden = ALL_ASSURANCE_NAV_MODULE_KEYS.filter((k) => !rec.recommended_assurance_families_enabled.includes(k));

  let path = rec.recommended_default_landing_path;
  if (!isValidDefaultLandingPath(path, mode)) path = "/dashboard";

  return {
    workspace_mode: mode,
    advanced_modules_hidden: advHidden,
    assurance_modules_hidden: asmHidden,
    utility_modules_hidden: rec.recommended_utility_modules_hidden,
    home_hidden_sections: homeHidden(mode),
    search_scope: rec.recommended_search_scope,
    default_landing_path: path.startsWith("/") ? path : "/dashboard",
    autopilot_allow_execution: false,
  };
}

/**
 * Core-safe surface when apply fails or user picks minimal setup (§4.4, §19.2).
 * Same §24.1 forbidden-key rules as {@link recommendationToV6Patch}.
 */
export function coreFallbackV6Patch(): V6OrgSettingsMergePatch {
  return {
    workspace_mode: "core",
    advanced_modules_hidden: [...ALL_ADVANCED_NAV_MODULE_KEYS],
    assurance_modules_hidden: [...ALL_ASSURANCE_NAV_MODULE_KEYS],
    utility_modules_hidden: utilityHiddenForAnswers(CORE_FALLBACK_ANSWERS),
    home_hidden_sections: [...HOME_SECTION_IDS],
    search_scope: "core_only",
    default_landing_path: "/dashboard",
    autopilot_allow_execution: false,
  };
}

/** Plan §6 — public name for deterministic recommendation (`finalizeRecommendation`). */
export const computeRecommendation: typeof finalizeRecommendation = finalizeRecommendation;

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { coreFallbackV6Patch as coreFallbackPatch };
export { recommendationToV6Patch as recommendationToPatch };
// End version-name compatibility aliases.
