/** User-visible copy for onboarding calibration (onboarding spec §8–§14). */

import type { CalibrationHistoryEntry } from "@/lib/onboarding/calibration-types";
import type { SetupChecklistStepKey } from "@/lib/onboarding/calibration-map";
import type { ProductSearchScope } from "@/lib/product-surface/types";

export const calibrationFlowTitle = "Set up your contract tracking workspace";
export const calibrationFlowSubtitle =
  "Answer a few questions so Oblixa can focus your workspace on the renewals, owners, obligations, evidence, and reports that matter most.";

/** onboarding spec §10.3 — optional org role nudge on dashboard after calibration (copy-only; does not change mode). */
export const dashboardOrgRoleCalibrationNudge =
  "Your optional role answer helped order the getting-started checklist.";

export const reviewStepTitle = "Your workspace is ready to track contracts";
export const reviewChangeLater =
  "You can adjust reminder defaults, reports, and first steps later from Settings.";

export const actionApply = "Upload first contract";
export const actionSimpler = "Go to dashboard";
export const actionSkipMinimal = "Finish setup later";
export const actionSettings = "Review setup";

export const stepLabels = {
  primary_use_case: "What is your first goal in Oblixa?",
  team_model: "How many people need to track contract work?",
  workflow_maturity: "Where do your signed contracts live today?",
  main_pain: "What is your biggest problem today?",
  complexity_preference: "How do you want to start?",
  setup_intent: "What should Oblixa help you do first?",
  assurance_intent: "Do you need formal controls or review boards?",
  optional: "Optional details",
  review: "Review",
} as const;

export const options = {
  primary_use_case: [
    { id: "track_contracts_dates" as const, label: "Upload signed contracts and track dates" },
    { id: "tasks_approvals_obligations" as const, label: "Review key terms and obligations" },
    { id: "coordinate_renewals_decisions" as const, label: "Track renewals and notice deadlines" },
    { id: "assurance_control_workflows" as const, label: "Collect evidence and prepare reports" },
  ],
  team_model: [
    { id: "solo" as const, label: "Just me" },
    { id: "small_2_5" as const, label: "2–5 people" },
    { id: "medium_6_20" as const, label: "6–20 people" },
    { id: "large_cross_functional" as const, label: "More than 20 people" },
  ],
  workflow_maturity: [
    { id: "manual_spreadsheet" as const, label: "Mostly in a spreadsheet" },
    { id: "somewhat_structured" as const, label: "Shared folders or a drive" },
    { id: "well_defined_cross_team" as const, label: "Email, folders, and calendar reminders" },
    { id: "highly_structured_policy" as const, label: "Several systems and manual handoffs" },
  ],
  main_pain: [
    { id: "find_contracts_dates" as const, label: "Finding contracts and key dates" },
    { id: "tasks_obligations" as const, label: "Keeping tasks and obligations organized" },
    { id: "decisions_handoffs" as const, label: "Knowing who owns each agreement" },
    { id: "risk_drift_control" as const, label: "Preparing reports without rebuilding a spreadsheet" },
  ],
  complexity_preference: [
    { id: "simplest" as const, label: "Start with the basics" },
    { id: "more_if_helps" as const, label: "Show reminders and work when useful" },
    { id: "comfortable_advanced" as const, label: "Include evidence and reporting from the start" },
    { id: "full_visibility" as const, label: "Show all contract tracking details" },
  ],
  setup_intent: [
    { id: "upload_import" as const, label: "Upload or import contracts" },
    { id: "review_extracted_fields" as const, label: "Review extracted fields" },
    { id: "organize_work_renewals" as const, label: "Organize work and renewals" },
    { id: "configure_workflows_advanced" as const, label: "Request evidence and export reports" },
  ],
  assurance_intent: [
    { id: "not_now" as const, label: "Not now" },
    { id: "maybe_later" as const, label: "Maybe later" },
    { id: "yes_workspace" as const, label: "Yes, for selected contract work" },
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
    ? "Search starts with contracts, fields, work, and evidence."
    : "Search includes contract records, related work, evidence, and reports.";
}

export function labelForDashboardProfile(
  profile: "core" | "advanced" | "assurance_lite",
  workspaceMode: "core" | "advanced" | "assurance"
): string {
  if (profile === "core" || workspaceMode === "core") {
    return "Dashboard highlights review needs, deadlines, owners, work, evidence, and reports.";
  }
  if (profile === "advanced" || workspaceMode === "advanced") {
    return "Dashboard can include larger-team contract tracking once enabled.";
  }
  return "Dashboard stays focused on contract tracking until private workflows are enabled.";
}

export function labelForNotificationSuppressAdvanced(suppress: boolean): string {
  return suppress
    ? "Email starts with renewal, notice, field review, work, evidence, and weekly digest reminders."
    : "Email reminders follow the contract tracking categories enabled for this workspace.";
}

export function labelForReportProfileSuppress(suppress: boolean): string {
  return suppress
    ? "Reports start with Core contract tracking views until more data is reviewed."
    : "Reports can use reviewed fields, owners, dates, work, evidence, and exports.";
}

export const calibrationHistoryChoiceLabels: {
  [K in CalibrationHistoryEntry["choice"]]: string;
} = {
  accept: "Applied recommendation",
  simpler: "Completed Core setup",
  settings: "Reviewed setup",
  skip: "Finished setup later",
  recalibrate: "Started calibration again",
};

/** Review step subsection titles (visible + `aria-labelledby` targets). */
export const reviewUtilitiesNoneHidden =
  "No extra tool shortcuts hidden beyond defaults.";

export const reviewSectionHeadings = {
  summary: "Ready to start",
  advanced: "Contract tracking focus",
  assurance: "Evidence and reports",
  landing: "Default landing",
  setup: "Suggested first steps",
  reports: "Reports and subscriptions",
  home: "Home dashboard",
  search: "Search and shortcuts",
  notifications: "Email notifications",
  utilities: "Tool shortcuts",
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
