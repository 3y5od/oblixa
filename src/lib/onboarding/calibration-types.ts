/**
 * Onboarding questionnaire types (docs/onboarding.md §6, §9–§10, §16).
 * Persisted under organizations.v6_org_settings_json.onboarding_calibration.
 */
import type {
  AdvancedNavModuleKey,
  AssuranceNavModuleKey,
  ProductSearchScope,
  UtilityModuleKey,
  WorkspaceProductMode,
} from "@/lib/product-surface/types";

/**
 * Bump when answers or recommendation JSON shape changes. Writers always persist this version.
 * v1: no `recommended_report_profile` on `last_recommendation`.
 * v2: `last_recommendation.recommended_report_profile` present on new writes; readers treat missing as Core-safe defaults in UI only.
 */
export const ONBOARDING_CALIBRATION_JSON_VERSION = 2 as const;

export type OnboardingCalibrationStatus = "pending" | "in_progress" | "skipped" | "completed";

/** §9.1 */
export type PrimaryUseCaseId =
  | "track_contracts_dates"
  | "tasks_approvals_obligations"
  | "coordinate_renewals_decisions"
  | "assurance_control_workflows";

/** §9.2 */
export type TeamModelId = "solo" | "small_2_5" | "medium_6_20" | "large_cross_functional";

/** §9.3 */
export type WorkflowMaturityId =
  | "manual_spreadsheet"
  | "somewhat_structured"
  | "well_defined_cross_team"
  | "highly_structured_policy";

/** §9.4 */
export type MainPainId =
  | "find_contracts_dates"
  | "tasks_obligations"
  | "decisions_handoffs"
  | "risk_drift_control";

/** §9.5 */
export type ComplexityPreferenceId =
  | "simplest"
  | "more_if_helps"
  | "comfortable_advanced"
  | "full_visibility";

/** §9.6 */
export type SetupIntentId =
  | "upload_import"
  | "review_extracted_fields"
  | "organize_work_renewals"
  | "configure_workflows_advanced";

/** §9.7 */
export type AssuranceIntentId = "not_now" | "maybe_later" | "yes_workspace";

/** §10.1 */
export type IndustryEmphasisId =
  | "unspecified"
  | "prefer_not_say"
  | "saas"
  | "professional_services"
  | "regulated"
  | "other";

/** §10.2 */
export type ImportVolumeId = "unknown" | "low" | "medium" | "high";

/** §10.3 */
export type OrgRoleId = "unspecified" | "ic" | "manager" | "exec" | "legal_ops";

export type CalibrationAnswersRequired = {
  primary_use_case: PrimaryUseCaseId;
  team_model: TeamModelId;
  workflow_maturity: WorkflowMaturityId;
  main_pain: MainPainId;
  complexity_preference: ComplexityPreferenceId;
  setup_intent: SetupIntentId;
  assurance_intent: AssuranceIntentId;
};

export type CalibrationAnswersOptional = {
  industry_emphasis?: IndustryEmphasisId;
  import_volume?: ImportVolumeId;
  org_role?: OrgRoleId;
};

export type CalibrationRecommendation = {
  recommended_workspace_mode: WorkspaceProductMode;
  recommended_advanced_families_enabled: AdvancedNavModuleKey[];
  recommended_assurance_families_enabled: AssuranceNavModuleKey[];
  recommended_default_landing_path: string;
  recommended_dashboard_profile: "core" | "advanced" | "assurance_lite";
  recommended_search_scope: ProductSearchScope;
  /** Structured hint for notification policy merge. */
  recommended_notification_profile: {
    suppress_advanced_tiers: boolean;
  };
  /**
   * Report-pack / subscription alignment (docs/onboarding.md §5–§6). Runtime enforcement on downgrade:
   * `src/lib/product-surface/workspace-transition.ts`.
   */
  recommended_report_profile: {
    suppress_incompatible_subscriptions: boolean;
    aligns_with_workspace_transition: true;
  };
  recommended_setup_checklist: string[];
  recommended_utility_modules_hidden: UtilityModuleKey[];
};

export type CalibrationAppliedSnapshot = {
  applied_at: string;
  applied_by_user_id: string;
  applied_workspace_mode: WorkspaceProductMode;
  advanced_modules_hidden: AdvancedNavModuleKey[];
  assurance_modules_hidden: AssuranceNavModuleKey[];
  utility_modules_hidden?: string[];
  home_hidden_sections: string[];
  search_scope: ProductSearchScope;
  default_landing_path: string | null;
};

export type CalibrationHistoryEntry = {
  at: string;
  actor_user_id: string;
  prior_mode: WorkspaceProductMode;
  next_mode: WorkspaceProductMode;
  choice: "accept" | "simpler" | "settings" | "skip" | "recalibrate";
};

export type OnboardingCalibrationState = {
  version: number;
  /**
   * True only for orgs created via ensureUserOrg (new workspace admin).
   * Invite acceptance does not set this. Typical RLS: any org member may read `organizations` and thus
   * this JSON; UI must not expose answers on non-admin surfaces (docs/onboarding.md §21).
   */
  blocking_required: boolean;
  status: OnboardingCalibrationStatus;
  questionnaire_started_at?: string;
  questionnaire_completed_at?: string;
  last_skipped_at?: string;
  /** Partial while in progress; all keys present after completion. */
  answers_required?: Partial<CalibrationAnswersRequired>;
  answers_optional?: CalibrationAnswersOptional;
  last_recommendation?: CalibrationRecommendation;
  last_applied?: CalibrationAppliedSnapshot;
  history?: CalibrationHistoryEntry[];
};

/**
 * §4.4 ladder — first-run blocking gate lives in proxy/callback + this JSON; `DISABLE_ONBOARDING_CALIBRATION_GATE`
 * bypasses redirect only. Stale `in_progress` blocking orgs are expired by cron
 * `GET /api/cron/v6/onboarding-calibration-stale` (env: `ONBOARDING_CALIBRATION_STALE_AFTER_DAYS`, default 30;
 * optional phase-2 `ONBOARDING_CALIBRATION_PENDING_STALE_AFTER_DAYS` vs `organizations.created_at`
 * (missing `created_at` → cron JSON `skipped_missing_org_created_at`);
 * operator kill-switch `DISABLE_ONBOARDING_CALIBRATION_STALE_CRON`; dry-run `ONBOARDING_CALIBRATION_STALE_CRON_DRY_RUN`;
 * optional write pacing `ONBOARDING_CALIBRATION_STALE_MS_BETWEEN_ORGS`). Recalibration with `blocking_required: false`
 * is never auto-expired. Non-goal: no client session timer for blocking timeout.
 *
 * Read compat: persisted rows may have `version` 1 without `last_recommendation.recommended_report_profile`.
 * UI-only defaults apply; do not run a second merge solely to backfill that field.
 */
export function parseOnboardingCalibration(raw: unknown): OnboardingCalibrationState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "number") return undefined;
  if (typeof o.blocking_required !== "boolean") return undefined;
  const status = o.status;
  if (
    status !== "pending" &&
    status !== "in_progress" &&
    status !== "skipped" &&
    status !== "completed"
  ) {
    return undefined;
  }
  return raw as OnboardingCalibrationState;
}

export function isOnboardingBlockingForAdmin(input: {
  role: string;
  calibration: OnboardingCalibrationState | undefined;
}): boolean {
  if (input.role !== "admin") return false;
  const c = input.calibration;
  if (!c?.blocking_required) return false;
  return c.status === "pending" || c.status === "in_progress";
}
