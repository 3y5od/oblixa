/** User-visible copy for onboarding calibration (docs/onboarding.md §8–§14). */

import type { CalibrationHistoryEntry } from "@/lib/onboarding/calibration-types";
import type { SetupChecklistStepKey } from "@/lib/onboarding/calibration-map";
import type { ProductSearchScope } from "@/lib/product-surface/types";

export const calibrationFlowTitle = "Set up your workspace";
export const calibrationFlowSubtitle =
  "A few quick choices so we show the right parts of Oblixa. You can change this anytime in Settings.";

/** docs/onboarding.md §10.3 — optional org role nudge on dashboard after calibration (copy-only; does not change mode). */
export const dashboardOrgRoleCalibrationNudge =
  "Your optional role answer helped set the suggested landing path and getting-started checklist order.";

export const reviewStepTitle = "Review your setup";
export const reviewChangeLater =
  "You can change workspace mode and visible areas later in Settings → Product experience.";

export const actionApply = "Apply recommendation";
export const actionSimpler = "Start with simpler setup";
export const actionSkipMinimal = "Skip questionnaire (minimal setup)";
export const actionSettings = "Review advanced options";

export const stepLabels = {
  primary_use_case: "What do you mainly want to do in Oblixa right now?",
  team_model: "Who will use this workspace?",
  workflow_maturity: "How structured are your current contract operations?",
  main_pain: "What is your biggest problem today?",
  complexity_preference: "How much product complexity do you want at the start?",
  setup_intent: "What do you want to do first?",
  assurance_intent: "Do you need policy, control, or assurance features right now?",
  optional: "Optional details",
  review: "Review",
} as const;

export const options = {
  primary_use_case: [
    { id: "track_contracts_dates" as const, label: "Track signed contracts and dates" },
    { id: "tasks_approvals_obligations" as const, label: "Manage tasks, approvals, and obligations" },
    { id: "coordinate_renewals_decisions" as const, label: "Coordinate renewals and decisions across a team" },
    { id: "assurance_control_workflows" as const, label: "Run more advanced control or assurance workflows" },
  ],
  team_model: [
    { id: "solo" as const, label: "Just me" },
    { id: "small_2_5" as const, label: "2–5 people" },
    { id: "medium_6_20" as const, label: "6–20 people" },
    { id: "large_cross_functional" as const, label: "Larger or cross-functional team" },
  ],
  workflow_maturity: [
    { id: "manual_spreadsheet" as const, label: "Mostly manual or spreadsheet-based" },
    { id: "somewhat_structured" as const, label: "Somewhat structured with recurring processes" },
    { id: "well_defined_cross_team" as const, label: "Well-defined workflows across teams" },
    { id: "highly_structured_policy" as const, label: "Highly structured with policy and review layers" },
  ],
  main_pain: [
    { id: "find_contracts_dates" as const, label: "Finding contracts and key dates" },
    { id: "tasks_obligations" as const, label: "Keeping tasks and obligations organized" },
    { id: "decisions_handoffs" as const, label: "Coordinating decisions and handoffs" },
    { id: "risk_drift_control" as const, label: "Monitoring risk, drift, and control issues" },
  ],
  complexity_preference: [
    { id: "simplest" as const, label: "Keep it as simple as possible" },
    { id: "more_if_helps" as const, label: "Show me more if it helps execution" },
    { id: "comfortable_advanced" as const, label: "I am comfortable with advanced workflows" },
    { id: "full_visibility" as const, label: "I want full operational visibility" },
  ],
  setup_intent: [
    { id: "upload_import" as const, label: "Upload or import contracts" },
    { id: "review_extracted_fields" as const, label: "Review extracted fields" },
    { id: "organize_work_renewals" as const, label: "Organize work and renewals" },
    { id: "configure_workflows_advanced" as const, label: "Configure workflows and advanced operations" },
  ],
  assurance_intent: [
    { id: "not_now" as const, label: "Not now" },
    { id: "maybe_later" as const, label: "Maybe later" },
    { id: "yes_workspace" as const, label: "Yes, for this workspace" },
  ],
  industry_emphasis: [
    { id: "unspecified" as const, label: "Skip" },
    { id: "prefer_not_say" as const, label: "Prefer not to say" },
    { id: "saas" as const, label: "Software / SaaS" },
    { id: "professional_services" as const, label: "Professional services" },
    { id: "regulated" as const, label: "Regulated industry" },
    { id: "other" as const, label: "Other" },
  ],
  import_volume: [
    { id: "unknown" as const, label: "Not sure yet" },
    { id: "low" as const, label: "A few contracts" },
    { id: "medium" as const, label: "Dozens" },
    { id: "high" as const, label: "Large volume / bulk import" },
  ],
  org_role: [
    { id: "unspecified" as const, label: "Skip" },
    { id: "ic" as const, label: "Individual contributor" },
    { id: "manager" as const, label: "Manager" },
    { id: "exec" as const, label: "Executive" },
    { id: "legal_ops" as const, label: "Legal / ops" },
  ],
} as const;

export const modeLabels: Record<"core" | "advanced" | "assurance", string> = {
  core: "Core",
  advanced: "Advanced",
  assurance: "Assurance",
};

/** Shared map: wizard review, settings summary, onboarding banner suggested order. */
export const setupChecklistKeyLabels: Record<SetupChecklistStepKey, string> = {
  bulk_import: "Bulk import contracts",
  upload_contract: "Upload contracts",
  review_fields: "Review extracted fields",
  organize_work: "Organize work and renewals",
  product_settings: "Tune product experience settings",
  compliance_alignment: "Align compliance-oriented setup",
};

export function labelForSetupChecklistKey(key: string): string {
  return setupChecklistKeyLabels[key as SetupChecklistStepKey] ?? key;
}

export function formatSetupChecklistSummary(keys: string[]): string {
  if (!keys.length) return "No checklist steps.";
  return keys.map(labelForSetupChecklistKey).join(" → ");
}

export function labelForSearchScope(scope: ProductSearchScope): string {
  return scope === "core_only"
    ? "Command palette and shortcuts stay on Core-safe paths only."
    : "Command palette and shortcuts can include destinations that match your workspace mode.";
}

export function labelForDashboardProfile(
  profile: "core" | "advanced" | "assurance_lite",
  workspaceMode: "core" | "advanced" | "assurance"
): string {
  if (profile === "core" || workspaceMode === "core") {
    return "Home dashboard uses a focused Core layout (portfolio-style blocks stay hidden).";
  }
  if (profile === "advanced" || workspaceMode === "advanced") {
    return "Home dashboard can show advanced portfolio strips; Assurance-style blocks stay minimal.";
  }
  return "Home dashboard uses an Assurance-oriented layout with selected portfolio visibility.";
}

export function labelForNotificationSuppressAdvanced(suppress: boolean): string {
  return suppress
    ? "Email will mute advanced and assurance notification categories until you enable those areas."
    : "Email categories follow your workspace mode (advanced or assurance notices may apply).";
}

export function labelForReportProfileSuppress(suppress: boolean): string {
  return suppress
    ? "Scheduled report subscriptions that need higher modes will be paused until you upgrade the workspace surface."
    : "Report subscriptions are not auto-paused for mode mismatch.";
}

export const calibrationHistoryChoiceLabels: {
  [K in CalibrationHistoryEntry["choice"]]: string;
} = {
  accept: "Applied recommendation",
  simpler: "Chose simpler setup",
  settings: "Opened advanced product settings",
  skip: "Skipped questionnaire (minimal setup)",
  recalibrate: "Started calibration again",
};

/** Review step subsection titles (visible + `aria-labelledby` targets). */
export const reviewUtilitiesNoneHidden =
  "No extra utility shortcuts hidden beyond defaults.";

export const reviewSectionHeadings = {
  summary: "Recommended workspace mode",
  advanced: "Advanced areas visible",
  assurance: "Assurance areas visible",
  landing: "Default landing",
  setup: "Suggested first steps",
  reports: "Reports and subscriptions",
  home: "Home dashboard",
  search: "Search and shortcuts",
  notifications: "Email notifications",
  utilities: "Utility shortcuts",
} as const;

/** `data-testid` hooks for E2E and RTL (stable selectors). */
export const calibrationReviewTestIds = {
  root: "calibration-review-root",
  setup: "calibration-review-setup",
  reports: "calibration-review-reports",
  home: "calibration-review-home",
  searchScope: "calibration-review-search-scope",
  notifications: "calibration-review-notifications",
  utilities: "calibration-review-utilities",
} as const;

/** Settings questionnaire card markers (static tests). */
export const settingsCalibrationMarkers = {
  historyDetails: "settings-calibration-history",
  lastAppliedDetails: "settings-calibration-last-applied",
  lastRecommendationDetails: "settings-calibration-last-recommendation",
} as const;

/** FUTURE(i18n): replace literals by key lookup from this manifest (no i18n framework in this repo yet). */
export const CALIBRATION_COPY_KEYS = [
  "calibrationFlowTitle",
  "calibrationFlowSubtitle",
  "dashboardOrgRoleCalibrationNudge",
  "reviewStepTitle",
  "reviewChangeLater",
  "actionApply",
  "actionSimpler",
  "actionSkipMinimal",
  "actionSettings",
  "stepLabels",
  "options",
  "modeLabels",
] as const;
