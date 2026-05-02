import { V10_ACCEPTANCE_GATES, V10_GA_SAMPLE_SIZES, type V10AcceptanceGate } from "./v10-release-contract";
import { V10_SLO_DASHBOARD_EVIDENCE } from "./v10-objective-telemetry";

export type V10ObjectiveMeasurementKey = keyof typeof V10_GA_SAMPLE_SIZES;
export type V10ObjectiveMeasurementWindow = "pre_ga_release_candidate" | "post_ga_7_day" | "post_ga_30_day";

export type V10ObjectiveMeasurementRule = {
  metricKey: V10ObjectiveMeasurementKey;
  numerator: string;
  denominator: string;
  fixedSampleSize: number;
  allowedExclusions: readonly string[];
  sampleFreezeRequired: boolean;
  rerunRule: "same_denominator_only" | "new_window_required";
  staleAfterDays: number;
  promotionThreshold: number;
  window: V10ObjectiveMeasurementWindow;
};

export type V10ObjectiveMeasurementRun = {
  metricKey: V10ObjectiveMeasurementKey;
  numeratorCount: number;
  denominatorCount: number;
  excludedCount: number;
  exclusionReasons: readonly string[];
  denominatorLockId: string | null;
  capturedAt: string | null;
  rerunOfLockId?: string | null;
};

export type V10RcFixtureManifest = {
  fixtureId: string;
  metricKey: V10ObjectiveMeasurementKey;
  denominatorLockId: string;
  sampleSize: number;
  rebuildCommand: string;
  cleanupCommand: string;
  privacyScanCommand: string;
  checksum: string;
  generatedDataOnly: boolean;
};

export type V10RcFixtureCategory =
  | "empty_core_workspace"
  | "small_core_workspace"
  | "medium_core_workspace"
  | "large_core_workspace"
  | "degraded_core_workspace"
  | "advanced_decisions_campaigns_relationships"
  | "assurance_findings_controls_automation"
  | "missing_fields"
  | "renewals_inside_365_days"
  | "unassigned_overdue_blocked_work"
  | "evidence_lifecycle_states"
  | "report_export_job_states"
  | "privacy_redaction_cases"
  | "adversarial_route_cases";

export type V10RcFixtureCategoryDescriptor = {
  category: V10RcFixtureCategory;
  sourceShape: string;
  minimumRecords: number;
  generatedDataOnly: boolean;
  privacyScanRequired: boolean;
  resetBehavior: "truncate_fixture_scope" | "rebuild_from_seed" | "no_persistent_rows";
};

export type V10SyntheticMetricDescriptor = {
  metricKey: V10ObjectiveMeasurementKey;
  fixedSampleSize: number;
  fixtureCategories: readonly V10RcFixtureCategory[];
  launchWindow: V10ObjectiveMeasurementWindow;
  sampleLockPolicy: "fixed_denominator";
  exclusionAccounting: readonly string[];
  localEvidenceState: "synthetic_descriptor_only" | "integration_test_backed" | "browser_harness_required" | "human_study_required";
};

export type V10RcSeededJourney = {
  journeyKey: string;
  acceptanceGate: V10AcceptanceGate;
  fixtureCategories: readonly V10RcFixtureCategory[];
  metricKeys: readonly V10ObjectiveMeasurementKey[];
  requiredArtifacts: readonly ("denominator_lock" | "metric_run" | "audit_event" | "telemetry_event" | "teardown_report")[];
};

export type V10RcMetricCapturePlan = {
  metricKey: V10ObjectiveMeasurementKey;
  denominatorLockId: string;
  fixtureVersion: string;
  captureCommand: string;
  teardownCommand: string;
  promotedEvidenceProtected: boolean;
};

export type V10RcTeardownGuard = {
  guardKey: string;
  protectsPromotedEvidence: boolean;
  preservesDenominatorLocks: boolean;
  deletesFixtureRowsOnly: boolean;
  auditAction: string;
};

export type V10ObjectiveEvidenceExportRow = {
  metric_key: V10ObjectiveMeasurementKey;
  denominator_lock_id: string | null;
  fixed_sample_size: number;
  numerator_count: number;
  denominator_count: number;
  excluded_count: number;
  pass_rate: number;
  can_promote: boolean;
  exclusion_reasons: readonly string[];
  captured_at: string | null;
  evidence_command: string;
  deterministic_seed: string;
};

export type V10ObjectivePromotionEvidenceCapture = {
  metricKey: V10ObjectiveMeasurementKey;
  fixtureManifestId: string;
  denominatorLockId: string;
  fixedSampleSize: number;
  allowedExclusionCount: number;
  captureCommand: string;
  sloDashboardKey: string;
  releaseEvidenceKey: string;
  promotionRule: string;
};

export type V10ObjectiveMetricCapturePath = {
  metricKey: V10ObjectiveMeasurementKey;
  captureSource:
    | "activation_runtime"
    | "command_search_runtime"
    | "report_export_jobs"
    | "renewal_evidence_cron"
    | "work_read_model"
    | "contract_detail_browser"
    | "recoverable_state_browser"
    | "human_study";
  denominatorLockId: string;
  fixedSampleSize: number;
  sampleSplit: readonly string[];
  persistedMeasurementRecord: `v10-release:objective-metric:${string}`;
  releaseEvidenceCommand: string;
  requiredRuntimeArtifacts: readonly string[];
  exclusionPolicy: "fixed_denominator_with_allowed_exclusions";
};

const STANDARD_EXCLUSIONS = [
  "provider_outage_with_retryable_diagnostics",
  "fixture_data_invalidated",
  "user_abandoned_before_start",
  "duplicate_fixture_record",
  "user_canceled_job",
  "browser_closed_before_completion",
  "network_offline_with_retry_path",
  "idle_session_expired",
  "canceled_upload_before_acceptance",
] as const;

export const V10_RC_FIXTURE_CATEGORIES: readonly V10RcFixtureCategoryDescriptor[] = [
  {
    category: "empty_core_workspace",
    sourceShape: "workspace with no contracts, work, reports, or imported files",
    minimumRecords: 1,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "truncate_fixture_scope",
  },
  {
    category: "small_core_workspace",
    sourceShape: "core workspace with contracts, fields, work, evidence, renewals, reports, and exports",
    minimumRecords: 5,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "rebuild_from_seed",
  },
  {
    category: "medium_core_workspace",
    sourceShape: "core workspace large enough to exercise pagination, count parity, and dashboard rollups",
    minimumRecords: 50,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "rebuild_from_seed",
  },
  {
    category: "large_core_workspace",
    sourceShape: "10k-contract, 1k-work, and 50k-export descriptor without storing private source text",
    minimumRecords: 1000,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "no_persistent_rows",
  },
  {
    category: "degraded_core_workspace",
    sourceShape: "partial jobs, stale read models, provider failures, and retryable diagnostics",
    minimumRecords: 10,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "truncate_fixture_scope",
  },
  {
    category: "advanced_decisions_campaigns_relationships",
    sourceShape: "Advanced decisions, campaigns, simulations, accounts, counterparties, and relationships",
    minimumRecords: 12,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "rebuild_from_seed",
  },
  {
    category: "assurance_findings_controls_automation",
    sourceShape: "Assurance findings, controls, scorecards, playbooks, review boards, and automation approvals",
    minimumRecords: 12,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "rebuild_from_seed",
  },
  {
    category: "missing_fields",
    sourceShape: "required field gaps, rejected provenance, low confidence extraction, and remediation work",
    minimumRecords: 20,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "truncate_fixture_scope",
  },
  {
    category: "renewals_inside_365_days",
    sourceShape: "approved renewal and notice dates across due, blocked, reminded, and missed states",
    minimumRecords: 20,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "truncate_fixture_scope",
  },
  {
    category: "unassigned_overdue_blocked_work",
    sourceShape: "work rows spanning unassigned, overdue, blocked, stale owner, and recently completed states",
    minimumRecords: 25,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "truncate_fixture_scope",
  },
  {
    category: "evidence_lifecycle_states",
    sourceShape: "evidence requests, scoped external submissions, expired/revoked links, reminders, and review outcomes",
    minimumRecords: 20,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "truncate_fixture_scope",
  },
  {
    category: "report_export_job_states",
    sourceShape: "report runs, export jobs, row-count handoff, truncation, cancellation, retry, and artifact expiry",
    minimumRecords: 20,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "truncate_fixture_scope",
  },
  {
    category: "privacy_redaction_cases",
    sourceShape: "emails, private URLs, file names, token-shaped values, and raw-text sentinels that must be redacted",
    minimumRecords: 10,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "no_persistent_rows",
  },
  {
    category: "adversarial_route_cases",
    sourceShape: "cross-org, hidden-module, stale-version, idempotency-conflict, revoked-link, and unsafe-export inputs",
    minimumRecords: 10,
    generatedDataOnly: true,
    privacyScanRequired: true,
    resetBehavior: "no_persistent_rows",
  },
] as const;

export const V10_OBJECTIVE_MEASUREMENT_RULES: readonly V10ObjectiveMeasurementRule[] = [
  {
    metricKey: "activation",
    numerator: "workspaces_with_first_generated_work_item_and_dashboard_visibility",
    denominator: "accepted_activation_fixture_workspaces",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.activation,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.9,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "command_palette_search",
    numerator: "eligible_exact_match_queries_with_actionable_destination",
    denominator: "scripted_search_queries",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.command_palette_search,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "report_reliability",
    numerator: "report_runs_succeeded_or_retryable_partial_with_diagnostics",
    denominator: "started_report_runs",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.report_reliability,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "export_reliability",
    numerator: "exports_succeeded_or_retryable_partial_with_redaction",
    denominator: "started_export_jobs",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.export_reliability,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "renewal_reminders",
    numerator: "eligible_renewal_reminders_sent_or_blocked_with_diagnostic",
    denominator: "contracts_with_approved_renewal_dates_in_window",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.renewal_reminders,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "evidence_follow_up",
    numerator: "overdue_evidence_requests_with_notification_or_escalation",
    denominator: "overdue_evidence_requests",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.evidence_follow_up,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "work_reachability",
    numerator: "daily_brief_items_reaching_matching_work_or_recovery_destination",
    denominator: "scripted_daily_brief_items",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.work_reachability,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "contract_record_trust",
    numerator: "contracts_with_first_fold_health_next_action_provenance_and_audit",
    denominator: "sampled_contract_records",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.contract_record_trust,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "recoverability",
    numerator: "failed_or_empty_states_with_reason_diagnostic_and_next_action",
    denominator: "scripted_recoverable_states",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.recoverability,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.95,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "usability_participants",
    numerator: "participants_completing_scripted_first_time_activation_without_docs",
    denominator: "qualified_usability_participants",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.usability_participants,
    allowedExclusions: ["participant_no_show", "facilitator_error", "accessibility_accommodation_unavailable"],
    sampleFreezeRequired: true,
    rerunRule: "new_window_required",
    staleAfterDays: 30,
    promotionThreshold: 0.9,
    window: "pre_ga_release_candidate",
  },
  {
    metricKey: "scripted_first_time_activation_sessions",
    numerator: "scripted_activation_sessions_completed_with_audit_and_work_visibility",
    denominator: "scripted_activation_sessions_started",
    fixedSampleSize: V10_GA_SAMPLE_SIZES.scripted_first_time_activation_sessions,
    allowedExclusions: STANDARD_EXCLUSIONS,
    sampleFreezeRequired: true,
    rerunRule: "same_denominator_only",
    staleAfterDays: 14,
    promotionThreshold: 0.9,
    window: "pre_ga_release_candidate",
  },
] as const;

export const V10_RC_FIXTURE_MANIFESTS: readonly V10RcFixtureManifest[] = V10_OBJECTIVE_MEASUREMENT_RULES.map((rule) => ({
  fixtureId: `v10-rc-${rule.metricKey}`,
  metricKey: rule.metricKey,
  denominatorLockId: `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`,
  sampleSize: rule.fixedSampleSize,
  rebuildCommand: `npm run check:v10-suite -- --fixture ${rule.metricKey}`,
  cleanupCommand: `npm run check:v10-suite -- --cleanup-fixture ${rule.metricKey}`,
  privacyScanCommand: `npm run check:v10-release-evidence -- --privacy-scan ${rule.metricKey}`,
  checksum: `sha256:${rule.metricKey}:${rule.fixedSampleSize}`,
  generatedDataOnly: true,
}));

function getV10FixtureCategoriesForMetric(metricKey: V10ObjectiveMeasurementKey): readonly V10RcFixtureCategory[] {
  switch (metricKey) {
    case "activation":
    case "scripted_first_time_activation_sessions":
      return ["empty_core_workspace", "small_core_workspace", "missing_fields", "degraded_core_workspace"];
    case "command_palette_search":
      return [
        "small_core_workspace",
        "advanced_decisions_campaigns_relationships",
        "assurance_findings_controls_automation",
        "privacy_redaction_cases",
        "adversarial_route_cases",
      ];
    case "report_reliability":
    case "export_reliability":
      return ["medium_core_workspace", "large_core_workspace", "report_export_job_states", "privacy_redaction_cases"];
    case "renewal_reminders":
      return ["renewals_inside_365_days", "unassigned_overdue_blocked_work", "degraded_core_workspace"];
    case "evidence_follow_up":
      return ["evidence_lifecycle_states", "degraded_core_workspace", "privacy_redaction_cases"];
    case "work_reachability":
      return ["small_core_workspace", "unassigned_overdue_blocked_work", "advanced_decisions_campaigns_relationships", "assurance_findings_controls_automation"];
    case "contract_record_trust":
      return ["small_core_workspace", "missing_fields", "renewals_inside_365_days", "evidence_lifecycle_states"];
    case "recoverability":
      return ["degraded_core_workspace", "privacy_redaction_cases", "adversarial_route_cases"];
    case "usability_participants":
      return ["empty_core_workspace", "small_core_workspace"];
  }
}

function getV10LocalEvidenceState(metricKey: V10ObjectiveMeasurementKey): V10SyntheticMetricDescriptor["localEvidenceState"] {
  if (metricKey === "usability_participants") return "human_study_required";
  if (["work_reachability", "contract_record_trust", "recoverability", "scripted_first_time_activation_sessions"].includes(metricKey)) {
    return "browser_harness_required";
  }
  if (["report_reliability", "export_reliability", "renewal_reminders", "evidence_follow_up"].includes(metricKey)) {
    return "integration_test_backed";
  }
  return "integration_test_backed";
}

export const V10_SYNTHETIC_METRIC_DESCRIPTORS: readonly V10SyntheticMetricDescriptor[] = V10_OBJECTIVE_MEASUREMENT_RULES.map((rule) => ({
  metricKey: rule.metricKey,
  fixedSampleSize: rule.fixedSampleSize,
  fixtureCategories: getV10FixtureCategoriesForMetric(rule.metricKey),
  launchWindow: rule.window,
  sampleLockPolicy: "fixed_denominator",
  exclusionAccounting: [
    "exclusions_must_be_predeclared",
    "excluded_count_cannot_change_denominator_after_lock",
    "rerun_keeps_denominator_lock_or_starts_new_window",
    "provider_outage_requires_retryable_diagnostic",
  ],
  localEvidenceState: getV10LocalEvidenceState(rule.metricKey),
}));

export const V10_RC_SEEDED_JOURNEYS: readonly V10RcSeededJourney[] = [
  {
    journeyKey: "first_activation_to_work_item",
    acceptanceGate: "activation",
    fixtureCategories: ["empty_core_workspace", "small_core_workspace", "missing_fields"],
    metricKeys: ["activation", "scripted_first_time_activation_sessions"],
    requiredArtifacts: ["denominator_lock", "metric_run", "audit_event", "telemetry_event", "teardown_report"],
  },
  {
    journeyKey: "work_clearance_and_reachability",
    acceptanceGate: "work",
    fixtureCategories: ["small_core_workspace", "unassigned_overdue_blocked_work"],
    metricKeys: ["work_reachability", "recoverability"],
    requiredArtifacts: ["denominator_lock", "metric_run", "audit_event", "telemetry_event", "teardown_report"],
  },
  {
    journeyKey: "contract_record_trust_review",
    acceptanceGate: "contract_record",
    fixtureCategories: ["small_core_workspace", "missing_fields", "renewals_inside_365_days", "evidence_lifecycle_states"],
    metricKeys: ["contract_record_trust"],
    requiredArtifacts: ["denominator_lock", "metric_run", "telemetry_event", "teardown_report"],
  },
  {
    journeyKey: "renewal_prevention_and_evidence_followup",
    acceptanceGate: "renewal",
    fixtureCategories: ["renewals_inside_365_days", "evidence_lifecycle_states", "degraded_core_workspace"],
    metricKeys: ["renewal_reminders", "evidence_follow_up"],
    requiredArtifacts: ["denominator_lock", "metric_run", "audit_event", "telemetry_event", "teardown_report"],
  },
  {
    journeyKey: "search_report_export_recovery",
    acceptanceGate: "search",
    fixtureCategories: ["medium_core_workspace", "report_export_job_states", "privacy_redaction_cases", "adversarial_route_cases"],
    metricKeys: ["command_palette_search", "report_reliability", "export_reliability"],
    requiredArtifacts: ["denominator_lock", "metric_run", "audit_event", "telemetry_event", "teardown_report"],
  },
] as const;

export const V10_RC_METRIC_CAPTURE_PLANS: readonly V10RcMetricCapturePlan[] = V10_OBJECTIVE_MEASUREMENT_RULES.map((rule) => ({
  metricKey: rule.metricKey,
  denominatorLockId: `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`,
  fixtureVersion: `v10-rc-${rule.metricKey}-v1`,
  captureCommand: `npm run check:v10-release-evidence -- --metric ${rule.metricKey} --lock v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`,
  teardownCommand: `npm run check:v10-suite -- --cleanup-fixture ${rule.metricKey}`,
  promotedEvidenceProtected: true,
}));

export const V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE: readonly V10ObjectivePromotionEvidenceCapture[] =
  V10_OBJECTIVE_MEASUREMENT_RULES.map((rule) => ({
    metricKey: rule.metricKey,
    fixtureManifestId: `v10-rc-${rule.metricKey}`,
    denominatorLockId: `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`,
    fixedSampleSize: rule.fixedSampleSize,
    allowedExclusionCount: rule.allowedExclusions.length,
    captureCommand: `npm run check:v10-release-evidence -- --metric ${rule.metricKey} --lock v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`,
    sloDashboardKey: getV10SloDashboardKeyForMetric(rule.metricKey),
    releaseEvidenceKey: `v10-release:objective:${rule.metricKey}`,
    promotionRule: `pass_rate_gte_${rule.promotionThreshold}_within_${rule.staleAfterDays}_days`,
  }));

function getV10ObjectiveCaptureSource(metricKey: V10ObjectiveMeasurementKey): V10ObjectiveMetricCapturePath["captureSource"] {
  switch (metricKey) {
    case "activation":
    case "scripted_first_time_activation_sessions":
      return "activation_runtime";
    case "command_palette_search":
      return "command_search_runtime";
    case "report_reliability":
    case "export_reliability":
      return "report_export_jobs";
    case "renewal_reminders":
    case "evidence_follow_up":
      return "renewal_evidence_cron";
    case "work_reachability":
      return "work_read_model";
    case "contract_record_trust":
      return "contract_detail_browser";
    case "recoverability":
      return "recoverable_state_browser";
    case "usability_participants":
      return "human_study";
  }
}

function getV10ObjectiveSampleSplit(metricKey: V10ObjectiveMeasurementKey): readonly string[] {
  switch (metricKey) {
    case "activation":
      return ["50_upload_activations", "50_import_activations"];
    case "command_palette_search":
      return ["contract", "counterparty", "account", "saved_view", "work_item", "report_family", "settings"];
    case "report_reliability":
      return ["10_report_families", "2_minute_window", "10_minute_diagnostic_window"];
    case "export_reliability":
      return ["20_truncated_exports", "20_large_exports", "60_standard_exports"];
    case "renewal_reminders":
      return ["approved_dates_inside_365_days", "missing_dates_blocked_remediation"];
    case "evidence_follow_up":
      return ["due_minus_3", "due_now", "overdue", "expired_link", "revoked_link"];
    case "work_reachability":
      return ["home", "work", "command_palette", "contract_detail"];
    case "contract_record_trust":
      return ["lifecycle_statuses", "health_bands", "1440_by_900_above_fold"];
    case "recoverability":
      return ["empty", "loading", "partial", "failed", "unauthorized", "plan_gated"];
    case "usability_participants":
      return ["20_qualified_human_participants", "help_doc_outcome_recorded"];
    case "scripted_first_time_activation_sessions":
      return ["100_scripted_sessions", "audit_and_work_visibility"];
  }
}

export const V10_OBJECTIVE_METRIC_CAPTURE_PATHS: readonly V10ObjectiveMetricCapturePath[] =
  V10_OBJECTIVE_MEASUREMENT_RULES.map((rule) => ({
    metricKey: rule.metricKey,
    captureSource: getV10ObjectiveCaptureSource(rule.metricKey),
    denominatorLockId: `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`,
    fixedSampleSize: rule.fixedSampleSize,
    sampleSplit: getV10ObjectiveSampleSplit(rule.metricKey),
    persistedMeasurementRecord: `v10-release:objective-metric:${rule.metricKey}`,
    releaseEvidenceCommand: `npm run check:v10-release-evidence -- --metric ${rule.metricKey} --lock v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`,
    requiredRuntimeArtifacts: [
      "src/lib/v10-objective-measurements.ts",
      "src/lib/v10-release-evidence.ts",
      "src/lib/v10-objective-telemetry.ts",
    ],
    exclusionPolicy: "fixed_denominator_with_allowed_exclusions",
  }));

export const V10_RC_TEARDOWN_GUARDS: readonly V10RcTeardownGuard[] = [
  {
    guardKey: "preserve_promoted_release_evidence",
    protectsPromotedEvidence: true,
    preservesDenominatorLocks: true,
    deletesFixtureRowsOnly: true,
    auditAction: "release_fixture.teardown_promoted_evidence_preserved",
  },
  {
    guardKey: "preserve_historical_denominator_locks",
    protectsPromotedEvidence: true,
    preservesDenominatorLocks: true,
    deletesFixtureRowsOnly: true,
    auditAction: "release_fixture.teardown_denominator_lock_preserved",
  },
  {
    guardKey: "delete_generated_fixture_scope_only",
    protectsPromotedEvidence: true,
    preservesDenominatorLocks: true,
    deletesFixtureRowsOnly: true,
    auditAction: "release_fixture.teardown_generated_scope_deleted",
  },
] as const;

export function getV10SloDashboardKeyForMetric(metricKey: V10ObjectiveMeasurementKey): string {
  switch (metricKey) {
    case "activation":
    case "scripted_first_time_activation_sessions":
      return "activation_first_work_item";
    case "command_palette_search":
      return "command_palette_router_success";
    case "report_reliability":
    case "export_reliability":
      return "report_export_reliability";
    case "work_reachability":
      return "work_reachability";
    case "renewal_reminders":
    case "evidence_follow_up":
    case "contract_record_trust":
    case "recoverability":
    case "usability_participants":
      return "post_ga_operational_window";
  }
}

export function getV10ObjectiveMeasurementRule(metricKey: V10ObjectiveMeasurementKey): V10ObjectiveMeasurementRule {
  return V10_OBJECTIVE_MEASUREMENT_RULES.find((rule) => rule.metricKey === metricKey)!;
}

export function validateV10ObjectiveMeasurementRun(run: V10ObjectiveMeasurementRun, now = new Date()): string[] {
  const rule = getV10ObjectiveMeasurementRule(run.metricKey);
  const failures: string[] = [];
  if (run.denominatorCount !== rule.fixedSampleSize) failures.push("denominator_not_fixed_sample_size");
  if (!run.denominatorLockId) failures.push("denominator_lock_missing");
  if (!run.capturedAt) failures.push("captured_at_missing");
  if (run.numeratorCount + run.excludedCount > run.denominatorCount) failures.push("sample_accounting_exceeds_denominator");
  for (const reason of run.exclusionReasons) {
    if (!rule.allowedExclusions.includes(reason)) failures.push(`exclusion_not_allowed:${reason}`);
  }
  if (run.excludedCount > 0 && run.exclusionReasons.length === 0) failures.push("exclusion_reason_missing");
  if (rule.rerunRule === "same_denominator_only" && run.rerunOfLockId && run.rerunOfLockId !== run.denominatorLockId) {
    failures.push("rerun_denominator_changed");
  }
  if (run.capturedAt) {
    const staleAt = new Date(run.capturedAt);
    staleAt.setDate(staleAt.getDate() + rule.staleAfterDays);
    if (staleAt < now) failures.push("measurement_evidence_stale");
  }
  return failures;
}

export function getV10ObjectiveMeasurementPassRate(run: V10ObjectiveMeasurementRun): number {
  const measured = run.denominatorCount - run.excludedCount;
  return measured > 0 ? run.numeratorCount / measured : 0;
}

export function canPromoteV10ObjectiveMeasurement(run: V10ObjectiveMeasurementRun, now = new Date()): boolean {
  if (validateV10ObjectiveMeasurementRun(run, now).length > 0) return false;
  return getV10ObjectiveMeasurementPassRate(run) >= getV10ObjectiveMeasurementRule(run.metricKey).promotionThreshold;
}

export function getV10DeterministicFixtureSeed(metricKey: V10ObjectiveMeasurementKey, index = 0): string {
  const rule = getV10ObjectiveMeasurementRule(metricKey);
  return `v10:${metricKey}:${rule.fixedSampleSize}:${rule.window}:${index}`;
}

export function buildV10ObjectiveEvidenceExportRows(
  runs: readonly V10ObjectiveMeasurementRun[],
  now = new Date()
): V10ObjectiveEvidenceExportRow[] {
  return runs.map((run, index) => {
    const rule = getV10ObjectiveMeasurementRule(run.metricKey);
    return {
      metric_key: run.metricKey,
      denominator_lock_id: run.denominatorLockId,
      fixed_sample_size: rule.fixedSampleSize,
      numerator_count: run.numeratorCount,
      denominator_count: run.denominatorCount,
      excluded_count: run.excludedCount,
      pass_rate: getV10ObjectiveMeasurementPassRate(run),
      can_promote: canPromoteV10ObjectiveMeasurement(run, now),
      exclusion_reasons: run.exclusionReasons,
      captured_at: run.capturedAt,
      evidence_command: `npm run check:v10-release-evidence -- --metric ${run.metricKey} --lock ${run.denominatorLockId ?? "missing"}`,
      deterministic_seed: getV10DeterministicFixtureSeed(run.metricKey, index),
    };
  });
}

export function validateV10RcFixtureManifestSet(
  manifests: readonly V10RcFixtureManifest[] = V10_RC_FIXTURE_MANIFESTS
): string[] {
  const failures: string[] = [];
  const byMetric = new Map(manifests.map((manifest) => [manifest.metricKey, manifest]));
  for (const rule of V10_OBJECTIVE_MEASUREMENT_RULES) {
    const manifest = byMetric.get(rule.metricKey);
    if (!manifest) {
      failures.push(`fixture_manifest_missing:${rule.metricKey}`);
      continue;
    }
    if (manifest.sampleSize !== rule.fixedSampleSize) failures.push(`${rule.metricKey}:sample_size_mismatch`);
    if (manifest.denominatorLockId !== `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`) {
      failures.push(`${rule.metricKey}:denominator_lock_mismatch`);
    }
    if (!manifest.rebuildCommand.startsWith("npm run ")) failures.push(`${rule.metricKey}:rebuild_command_missing`);
    if (!manifest.cleanupCommand.startsWith("npm run ")) failures.push(`${rule.metricKey}:cleanup_command_missing`);
    if (!manifest.privacyScanCommand.includes("privacy-scan")) failures.push(`${rule.metricKey}:privacy_scan_missing`);
    if (!manifest.checksum.startsWith("sha256:")) failures.push(`${rule.metricKey}:checksum_missing`);
    if (!manifest.generatedDataOnly) failures.push(`${rule.metricKey}:generated_data_only_required`);
  }
  if (new Set(manifests.map((manifest) => manifest.fixtureId)).size !== manifests.length) {
    failures.push("fixture_id_duplicate");
  }
  return failures;
}

export function validateV10RcFixtureCategoryDescriptors(
  categories: readonly V10RcFixtureCategoryDescriptor[] = V10_RC_FIXTURE_CATEGORIES
): string[] {
  const failures: string[] = [];
  const requiredCategories: readonly V10RcFixtureCategory[] = [
    "empty_core_workspace",
    "small_core_workspace",
    "medium_core_workspace",
    "large_core_workspace",
    "degraded_core_workspace",
    "advanced_decisions_campaigns_relationships",
    "assurance_findings_controls_automation",
    "missing_fields",
    "renewals_inside_365_days",
    "unassigned_overdue_blocked_work",
    "evidence_lifecycle_states",
    "report_export_job_states",
    "privacy_redaction_cases",
    "adversarial_route_cases",
  ];
  const byCategory = new Map(categories.map((category) => [category.category, category]));
  for (const category of requiredCategories) {
    const descriptor = byCategory.get(category);
    if (!descriptor) {
      failures.push(`fixture_category_missing:${category}`);
      continue;
    }
    if (!descriptor.sourceShape.trim()) failures.push(`${category}:source_shape_missing`);
    if (descriptor.minimumRecords <= 0) failures.push(`${category}:minimum_records_required`);
    if (!descriptor.generatedDataOnly) failures.push(`${category}:generated_data_only_required`);
    if (!descriptor.privacyScanRequired) failures.push(`${category}:privacy_scan_required`);
  }
  if (new Set(categories.map((category) => category.category)).size !== categories.length) {
    failures.push("fixture_category_duplicate");
  }
  return failures;
}

export function validateV10SyntheticMetricDescriptors(
  descriptors: readonly V10SyntheticMetricDescriptor[] = V10_SYNTHETIC_METRIC_DESCRIPTORS
): string[] {
  const failures: string[] = [];
  const knownCategories = new Set(V10_RC_FIXTURE_CATEGORIES.map((category) => category.category));
  const byMetric = new Map(descriptors.map((descriptor) => [descriptor.metricKey, descriptor]));
  for (const rule of V10_OBJECTIVE_MEASUREMENT_RULES) {
    const descriptor = byMetric.get(rule.metricKey);
    if (!descriptor) {
      failures.push(`synthetic_metric_descriptor_missing:${rule.metricKey}`);
      continue;
    }
    if (descriptor.fixedSampleSize !== rule.fixedSampleSize) failures.push(`${rule.metricKey}:fixed_sample_size_mismatch`);
    if (descriptor.launchWindow !== rule.window) failures.push(`${rule.metricKey}:launch_window_mismatch`);
    if (descriptor.sampleLockPolicy !== "fixed_denominator") failures.push(`${rule.metricKey}:fixed_denominator_required`);
    if (descriptor.fixtureCategories.length === 0) failures.push(`${rule.metricKey}:fixture_category_required`);
    if (!descriptor.exclusionAccounting.includes("excluded_count_cannot_change_denominator_after_lock")) {
      failures.push(`${rule.metricKey}:denominator_lock_accounting_required`);
    }
    for (const category of descriptor.fixtureCategories) {
      if (!knownCategories.has(category)) failures.push(`${rule.metricKey}:unknown_fixture_category:${category}`);
    }
    if (rule.rerunRule === "new_window_required" && descriptor.localEvidenceState !== "human_study_required") {
      failures.push(`${rule.metricKey}:human_study_evidence_required`);
    }
    if (descriptor.localEvidenceState === "synthetic_descriptor_only") {
      failures.push(`${rule.metricKey}:synthetic_descriptor_not_promotable`);
    }
  }
  if (new Set(descriptors.map((descriptor) => descriptor.metricKey)).size !== descriptors.length) {
    failures.push("synthetic_metric_descriptor_duplicate");
  }
  return failures;
}

export function validateV10RcSeededJourneys(
  journeys: readonly V10RcSeededJourney[] = V10_RC_SEEDED_JOURNEYS
): string[] {
  const failures: string[] = [];
  const knownCategories = new Set(V10_RC_FIXTURE_CATEGORIES.map((category) => category.category));
  const knownMetrics = new Set(Object.keys(V10_GA_SAMPLE_SIZES));
  const coveredGates = new Set<V10AcceptanceGate>();
  for (const journey of journeys) {
    if (!journey.journeyKey) failures.push("journey_key_required");
    if (!V10_ACCEPTANCE_GATES.includes(journey.acceptanceGate)) failures.push(`${journey.journeyKey}:unknown_acceptance_gate`);
    coveredGates.add(journey.acceptanceGate);
    if (journey.fixtureCategories.length === 0) failures.push(`${journey.journeyKey}:fixture_category_required`);
    for (const category of journey.fixtureCategories) {
      if (!knownCategories.has(category)) failures.push(`${journey.journeyKey}:unknown_fixture_category:${category}`);
    }
    if (journey.metricKeys.length === 0) failures.push(`${journey.journeyKey}:metric_required`);
    for (const metric of journey.metricKeys) {
      if (!knownMetrics.has(metric)) failures.push(`${journey.journeyKey}:unknown_metric:${metric}`);
    }
    for (const artifact of ["denominator_lock", "metric_run", "teardown_report"] as const) {
      if (!journey.requiredArtifacts.includes(artifact)) failures.push(`${journey.journeyKey}:artifact_required:${artifact}`);
    }
  }
  for (const gate of ["activation", "work", "contract_record", "renewal", "search"] as const) {
    if (!coveredGates.has(gate)) failures.push(`seeded_journey_gate_missing:${gate}`);
  }
  return failures;
}

export function validateV10RcMetricCapturePlans(
  plans: readonly V10RcMetricCapturePlan[] = V10_RC_METRIC_CAPTURE_PLANS
): string[] {
  const failures: string[] = [];
  const byMetric = new Map(plans.map((plan) => [plan.metricKey, plan]));
  for (const rule of V10_OBJECTIVE_MEASUREMENT_RULES) {
    const plan = byMetric.get(rule.metricKey);
    if (!plan) {
      failures.push(`metric_capture_plan_missing:${rule.metricKey}`);
      continue;
    }
    const expectedLock = `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`;
    if (plan.denominatorLockId !== expectedLock) failures.push(`${rule.metricKey}:capture_lock_mismatch`);
    if (!plan.fixtureVersion.startsWith(`v10-rc-${rule.metricKey}`)) failures.push(`${rule.metricKey}:fixture_version_mismatch`);
    if (!plan.captureCommand.includes("--metric") || !plan.captureCommand.includes("--lock")) failures.push(`${rule.metricKey}:capture_command_incomplete`);
    if (!plan.teardownCommand.includes("--cleanup-fixture")) failures.push(`${rule.metricKey}:teardown_command_missing`);
    if (!plan.promotedEvidenceProtected) failures.push(`${rule.metricKey}:promoted_evidence_protection_required`);
  }
  return failures;
}

export function validateV10ObjectivePromotionEvidenceCapture(
  rows: readonly V10ObjectivePromotionEvidenceCapture[] = V10_OBJECTIVE_PROMOTION_EVIDENCE_CAPTURE
): string[] {
  const failures: string[] = [];
  const dashboardKeys = new Set(V10_SLO_DASHBOARD_EVIDENCE.map((row) => row.dashboardKey));
  const byMetric = new Map(rows.map((row) => [row.metricKey, row]));
  for (const rule of V10_OBJECTIVE_MEASUREMENT_RULES) {
    const row = byMetric.get(rule.metricKey);
    if (!row) {
      failures.push(`promotion_capture_missing:${rule.metricKey}`);
      continue;
    }
    const expectedLock = `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`;
    if (row.fixedSampleSize !== rule.fixedSampleSize) failures.push(`${rule.metricKey}:fixed_sample_size_mismatch`);
    if (row.denominatorLockId !== expectedLock) failures.push(`${rule.metricKey}:denominator_lock_mismatch`);
    if (row.fixtureManifestId !== `v10-rc-${rule.metricKey}`) failures.push(`${rule.metricKey}:fixture_manifest_mismatch`);
    if (row.allowedExclusionCount !== rule.allowedExclusions.length) failures.push(`${rule.metricKey}:exclusion_policy_mismatch`);
    if (!row.captureCommand.includes("--metric") || !row.captureCommand.includes("--lock")) {
      failures.push(`${rule.metricKey}:capture_command_incomplete`);
    }
    if (!dashboardKeys.has(row.sloDashboardKey)) failures.push(`${rule.metricKey}:slo_dashboard_missing`);
    if (!row.releaseEvidenceKey.startsWith("v10-release:objective:")) failures.push(`${rule.metricKey}:release_evidence_key_required`);
    if (!row.promotionRule.includes(String(rule.promotionThreshold)) || !row.promotionRule.includes(String(rule.staleAfterDays))) {
      failures.push(`${rule.metricKey}:promotion_rule_mismatch`);
    }
  }
  if (new Set(rows.map((row) => row.metricKey)).size !== rows.length) failures.push("promotion_capture_duplicate");
  return failures;
}

export function validateV10ObjectiveMetricCapturePaths(
  paths: readonly V10ObjectiveMetricCapturePath[] = V10_OBJECTIVE_METRIC_CAPTURE_PATHS
): string[] {
  const failures: string[] = [];
  const byMetric = new Map(paths.map((path) => [path.metricKey, path]));
  for (const rule of V10_OBJECTIVE_MEASUREMENT_RULES) {
    const path = byMetric.get(rule.metricKey);
    if (!path) {
      failures.push(`metric_capture_path_missing:${rule.metricKey}`);
      continue;
    }
    const expectedLock = `v10-rc:${rule.metricKey}:${rule.fixedSampleSize}`;
    if (path.denominatorLockId !== expectedLock) failures.push(`${rule.metricKey}:denominator_lock_mismatch`);
    if (path.fixedSampleSize !== rule.fixedSampleSize) failures.push(`${rule.metricKey}:fixed_sample_size_mismatch`);
    if (path.sampleSplit.length === 0) failures.push(`${rule.metricKey}:sample_split_required`);
    if (!path.persistedMeasurementRecord.startsWith("v10-release:objective-metric:")) {
      failures.push(`${rule.metricKey}:persisted_measurement_record_required`);
    }
    if (!path.releaseEvidenceCommand.includes("--metric") || !path.releaseEvidenceCommand.includes("--lock")) {
      failures.push(`${rule.metricKey}:release_evidence_command_required`);
    }
    if (path.requiredRuntimeArtifacts.length < 2) failures.push(`${rule.metricKey}:runtime_artifacts_required`);
    if (path.exclusionPolicy !== "fixed_denominator_with_allowed_exclusions") {
      failures.push(`${rule.metricKey}:fixed_denominator_exclusion_policy_required`);
    }
  }
  if (new Set(paths.map((path) => path.metricKey)).size !== paths.length) failures.push("metric_capture_path_duplicate");
  const activation = byMetric.get("activation");
  if (activation && !activation.sampleSplit.includes("50_upload_activations")) failures.push("activation:upload_split_required");
  if (activation && !activation.sampleSplit.includes("50_import_activations")) failures.push("activation:import_split_required");
  const exportReliability = byMetric.get("export_reliability");
  if (exportReliability && !exportReliability.sampleSplit.includes("20_truncated_exports")) {
    failures.push("export_reliability:truncated_export_split_required");
  }
  return failures;
}

export function validateV10RcTeardownGuards(
  guards: readonly V10RcTeardownGuard[] = V10_RC_TEARDOWN_GUARDS
): string[] {
  const failures: string[] = [];
  for (const guard of guards) {
    if (!guard.guardKey) failures.push("teardown_guard_key_required");
    if (!guard.protectsPromotedEvidence) failures.push(`${guard.guardKey}:promoted_evidence_protection_required`);
    if (!guard.preservesDenominatorLocks) failures.push(`${guard.guardKey}:denominator_lock_preservation_required`);
    if (!guard.deletesFixtureRowsOnly) failures.push(`${guard.guardKey}:fixture_scope_only_required`);
    if (!guard.auditAction.includes(".")) failures.push(`${guard.guardKey}:audit_action_required`);
  }
  if (!guards.some((guard) => guard.guardKey === "preserve_promoted_release_evidence")) failures.push("teardown_guard_missing:preserve_promoted_release_evidence");
  if (!guards.some((guard) => guard.guardKey === "preserve_historical_denominator_locks")) failures.push("teardown_guard_missing:preserve_historical_denominator_locks");
  return failures;
}
