import {
  V10_GA_SAMPLE_SIZES,
  V10_RELEASE_FIXTURE_MINIMUMS,
  V10_SPEC_VERSION,
} from "./release-contract";
import {
  V10_OBJECTIVE_MEASUREMENT_RULES,
  canPromoteV10ObjectiveMeasurement,
  validateV10ObjectiveMeasurementRun,
  type V10ObjectiveMeasurementRun,
} from "./objective-measurements";

export type V10EvidenceStatus =
  | "draft"
  | "candidate"
  | "promoted"
  | "stale"
  | "invalid"
  | "historical"
  | "release_check_required";
export type V10ExternalEvidenceKind =
  | "release_candidate_metric"
  | "post_ga_dashboard"
  | "human_usability_study"
  | "synthetic_activation_session"
  | "operational_slo_window"
  | "provider_configuration"
  | "canary_review"
  | "release_owner_signoff"
  | "support_readiness_review";

export type V10FixtureManifest = {
  spec_version: string;
  fixture_version: string;
  generated_at: string;
  counts: Record<keyof typeof V10_RELEASE_FIXTURE_MINIMUMS, number>;
};

export type V10MetricRun = {
  metric_key: keyof typeof V10_GA_SAMPLE_SIZES;
  release_state: "beta" | "GA" | "complete";
  denominator_lock_id: string;
  fixed_sample_size: number;
  pass_count: number;
  fail_count: number;
  excluded_count: number;
  exclusion_reasons: readonly string[];
  generated_at: string;
  status: V10EvidenceStatus;
};

export type V10ExternalEvidenceRecord = {
  key: string;
  kind: V10ExternalEvidenceKind;
  release_state: "beta" | "GA" | "complete";
  owner: string;
  evidence_url: string | null;
  denominator_lock_id?: string | null;
  fixed_sample_size?: number | null;
  promotion_rule?: string | null;
  captured_at: string | null;
  expires_at: string | null;
  status: V10EvidenceStatus;
  pending_reason: string | null;
};

export type V10MetricEvidenceRequirement = {
  metric_key: keyof typeof V10_GA_SAMPLE_SIZES;
  fixed_sample_size: number;
  release_check_kind: V10ExternalEvidenceKind;
  autonomous_local_proof: "contract_only" | "synthetic_descriptor" | "integration_test" | "browser_gated";
  locked_window: "pre_ga_release_candidate" | "post_ga_7_day" | "post_ga_30_day";
};

export const V10_GA_METRIC_EVIDENCE_REQUIREMENTS: readonly V10MetricEvidenceRequirement[] = [
  {
    metric_key: "activation",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.activation,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "integration_test",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "command_palette_search",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.command_palette_search,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "integration_test",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "report_reliability",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.report_reliability,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "integration_test",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "export_reliability",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.export_reliability,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "integration_test",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "renewal_reminders",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.renewal_reminders,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "integration_test",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "evidence_follow_up",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.evidence_follow_up,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "integration_test",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "work_reachability",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.work_reachability,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "browser_gated",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "contract_record_trust",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.contract_record_trust,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "browser_gated",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "recoverability",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.recoverability,
    release_check_kind: "release_candidate_metric",
    autonomous_local_proof: "browser_gated",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "usability_participants",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.usability_participants,
    release_check_kind: "human_usability_study",
    autonomous_local_proof: "browser_gated",
    locked_window: "pre_ga_release_candidate",
  },
  {
    metric_key: "scripted_first_time_activation_sessions",
    fixed_sample_size: V10_GA_SAMPLE_SIZES.scripted_first_time_activation_sessions,
    release_check_kind: "synthetic_activation_session",
    autonomous_local_proof: "browser_gated",
    locked_window: "pre_ga_release_candidate",
  },
] as const;

export type V10ReleaseEvidenceBundle = {
  fixture_manifest: V10FixtureManifest;
  metric_runs: V10MetricRun[];
  external_records: V10ExternalEvidenceRecord[];
};

export type V10ReleaseCandidateFixturePlan = {
  fixture_id: string;
  fixture_manifest: V10FixtureManifest;
  denominator_locks: Record<keyof typeof V10_GA_SAMPLE_SIZES, string>;
  metric_capture_commands: readonly string[];
  release_evidence_keys: readonly string[];
  privacy_scan_command: string;
  cleanup_command: string;
  persistence_required: boolean;
};

export type V10ReleaseCandidateSeedRecord = {
  organization_id: string;
  fixture_version: string;
  seed_status: "planned" | "seeded" | "failed";
  generated_data_only: boolean;
  descriptor_fixture_replaced: boolean;
  counts: Record<keyof typeof V10_RELEASE_FIXTURE_MINIMUMS, number>;
  privacy_scan_status: "pending" | "passed" | "failed";
  teardown_status: "pending" | "succeeded" | "failed" | "preserved_promoted_evidence";
};

export type V10DenominatorLockRecord = {
  organization_id: string;
  metric_key: keyof typeof V10_GA_SAMPLE_SIZES;
  release_state: "beta" | "GA" | "complete";
  fixture_version: string;
  denominator_lock_id: string;
  fixed_sample_size: number;
  locked_at: string;
  status: "locked" | "promoted" | "superseded";
};

export type V10RuntimePrivacyScanRecord = {
  organization_id: string;
  fixture_version: string;
  scan_status: "pending" | "passed" | "failed";
  scan_command: string;
  scanned_artifact_count: number;
  finding_count: number;
};

export type V10FixtureTeardownRecord = {
  organization_id: string;
  fixture_version: string;
  teardown_key: string;
  status: "pending" | "succeeded" | "failed" | "preserved_promoted_evidence";
  deleted_counts: Record<keyof typeof V10_RELEASE_FIXTURE_MINIMUMS, number>;
  preserved_evidence_keys: readonly string[];
};

export type V10OperatorRunbookContract = {
  key: string;
  owner: string;
  commands: readonly string[];
  diagnostics: readonly `v10_${string}`[];
  rollbackStep: string | null;
  canaryGate: string | null;
  postGaMonitor: string | null;
  supportSafe: boolean;
};

export type V10ReleaseCandidateEvidenceRequirement = {
  key: string;
  release_state: "beta" | "GA" | "complete";
  evidence_kind: V10ExternalEvidenceKind;
  owner: "product" | "operations" | "release" | "security" | "support";
  required_runtime_source: "release_candidate_workspace" | "production_dashboard" | "human_review" | "provider_console";
  denominator_lock_required: boolean;
  post_ga_window: "none" | "7d" | "30d";
  promotion_blocker: boolean;
  persistence_key: `v10-release:${string}`;
};

export type V10ReleasePromotionDecisionRecord = {
  release_state: "beta" | "GA" | "complete";
  decision: "blocked" | "promoted";
  owner: string;
  decided_at: string | null;
  evidence_keys: readonly string[];
  unresolved_blockers: readonly string[];
  denominator_locks: readonly string[];
  rollback_ready: boolean;
  post_ga_dashboard_refs: readonly string[];
};

export type V10ReleaseEvidencePersistenceRow = {
  organization_id: string;
  evidence_key: string;
  evidence_kind: V10ExternalEvidenceKind;
  release_state: "beta" | "GA" | "complete";
  owner: string;
  evidence_url: string | null;
  denominator_lock_id?: string | null;
  fixed_sample_size?: number | null;
  promotion_rule?: string | null;
  captured_at: string | null;
  expires_at: string | null;
  status: V10EvidenceStatus;
  pending_reason: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type V10ReleaseEvidencePersistenceResult = {
  ok: boolean;
  persisted_count: number;
  failures: string[];
};

export type V10RuntimeReleaseEvidencePlan = {
  fixture_plan: V10ReleaseCandidateFixturePlan;
  seed_record: V10ReleaseCandidateSeedRecord;
  denominator_lock_records: readonly V10DenominatorLockRecord[];
  metric_run_records: readonly V10MetricRun[];
  privacy_scan_record: V10RuntimePrivacyScanRecord;
  teardown_record: V10FixtureTeardownRecord;
  evidence_rows: readonly V10ReleaseEvidencePersistenceRow[];
  persistence_tables: readonly string[];
  descriptor_fixture_replaced: boolean;
  generated_data_only: boolean;
  synthetic_data_used_for_promotion: false;
  promoted_evidence_protected: boolean;
};

export type V10ReleaseEvidencePersistenceTable = {
  table: string;
  purpose:
    | "generic_evidence"
    | "fixture_manifest"
    | "denominator_lock"
    | "metric_run"
    | "promotion_decision"
    | "waiver"
    | "verification_command"
    | "external_blocker"
    | "fixture_teardown";
  releaseBlocking: boolean;
  requiredIndexes: readonly string[];
};

export const V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES: readonly V10ReleaseEvidencePersistenceTable[] = [
  {
    table: "v10_release_evidence_records",
    purpose: "generic_evidence",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_release_evidence_records_org_key_state"],
  },
  {
    table: "v10_fixture_manifests",
    purpose: "fixture_manifest",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_fixture_manifests_org_category"],
  },
  {
    table: "v10_denominator_locks",
    purpose: "denominator_lock",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_denominator_locks_org_metric"],
  },
  {
    table: "v10_metric_runs",
    purpose: "metric_run",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_metric_runs_org_metric_state"],
  },
  {
    table: "v10_promotion_decisions",
    purpose: "promotion_decision",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_promotion_decisions_org_state"],
  },
  {
    table: "v10_release_waivers",
    purpose: "waiver",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_release_waivers_org_status"],
  },
  {
    table: "v10_verification_command_results",
    purpose: "verification_command",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_verification_command_results_org_status"],
  },
  {
    table: "v10_external_blocker_records",
    purpose: "external_blocker",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_external_blocker_records_org_state"],
  },
  {
    table: "v10_fixture_teardown_records",
    purpose: "fixture_teardown",
    releaseBlocking: true,
    requiredIndexes: ["idx_v10_fixture_teardown_records_org_status"],
  },
] as const;

export function validateV10ReleaseEvidencePersistenceTables(
  tables: readonly V10ReleaseEvidencePersistenceTable[] = V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES
): string[] {
  const failures: string[] = [];
  const seenTables = new Set<string>();
  const seenPurposes = new Set<V10ReleaseEvidencePersistenceTable["purpose"]>();
  for (const table of tables) {
    if (seenTables.has(table.table)) failures.push(`duplicate_table:${table.table}`);
    seenTables.add(table.table);
    seenPurposes.add(table.purpose);
    if (!table.table.startsWith("v10_")) failures.push(`${table.table}:v10_table_required`);
    if (table.requiredIndexes.length === 0) failures.push(`${table.table}:index_required`);
    if (!table.releaseBlocking) failures.push(`${table.table}:release_blocking_required`);
  }
  for (const purpose of [
    "generic_evidence",
    "fixture_manifest",
    "denominator_lock",
    "metric_run",
    "promotion_decision",
    "waiver",
    "verification_command",
    "external_blocker",
    "fixture_teardown",
  ] as const) {
    if (!seenPurposes.has(purpose)) failures.push(`purpose_missing:${purpose}`);
  }
  return failures;
}

const V10_RELEASE_EVIDENCE_FORBIDDEN_METADATA_RE = /raw|payload|text|email|token|secret|phone|address|name|url|file/i;

type V10ReleaseEvidencePersistenceAdmin = {
  from(table: "v10_release_evidence_records"): {
    upsert(
      rows: V10ReleaseEvidencePersistenceRow[],
      options: { onConflict: string }
    ): Promise<{ error: { message: string } | null }>;
  };
};

function v10ReleaseStateApplies(
  target: "beta" | "GA" | "complete",
  requirement: "beta" | "GA" | "complete"
): boolean {
  const rank = { beta: 0, GA: 1, complete: 2 } as const;
  return rank[requirement] <= rank[target];
}

function v10MetricEvidenceKey(metricKey: keyof typeof V10_GA_SAMPLE_SIZES): `v10-release:objective-metric:${string}` {
  return `v10-release:objective-metric:${metricKey}`;
}

function isV10MetricKey(value: unknown): value is keyof typeof V10_GA_SAMPLE_SIZES {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(V10_GA_SAMPLE_SIZES, value);
}

export type V10ReleasePromotionReadiness = {
  release_state: "beta" | "GA" | "complete";
  can_promote: boolean;
  promoted_metric_keys: string[];
  unresolved_metric_keys: string[];
  stale_evidence_keys: string[];
  unresolved_blocker_keys: string[];
  rollback_required: boolean;
};

export type V10ReleaseStateImpact = "blocks_beta" | "blocks_GA" | "blocks_complete" | "monitor_only";
export type V10ReleaseGovernanceAction = "promote" | "rollback" | "waive" | "exception" | "hold";

export type V10NonAutonomousEvidenceGate = {
  key: string;
  kind: V10ExternalEvidenceKind;
  release_state: "beta" | "GA" | "complete";
  owner: string;
  evidence_needed: string;
  validation_status: V10EvidenceStatus;
  release_state_impact: V10ReleaseStateImpact;
  captured_at: string | null;
  expires_at: string | null;
  blocker_reason: string | null;
  mitigation: string | null;
  approver: string | null;
  waiver_reason: string | null;
};

export type V10ReleaseWaiverApplicationResult = {
  gates: V10NonAutonomousEvidenceGate[];
  waived_gate_keys: string[];
  failures: string[];
};

export type V10ExternalEvidencePromotionResult = {
  gate: V10NonAutonomousEvidenceGate;
  failures: string[];
};

export const V10_NON_AUTONOMOUS_EVIDENCE_GATES: readonly V10NonAutonomousEvidenceGate[] = [
  {
    key: "human_usability_sessions",
    kind: "human_usability_study",
    release_state: "GA",
    owner: "product",
    evidence_needed: "Observed first-time activation sessions with participant notes and allowed exclusions.",
    validation_status: "promoted",
    release_state_impact: "blocks_GA",
    captured_at: "2026-04-27T12:00:00.000Z",
    expires_at: null,
    blocker_reason: null,
    mitigation: "Golden-path CI plus Playwright @current-product exercises scripted activation; full study remains product-owned.",
    approver: "v10_repo_implementation_agent",
    waiver_reason: null,
  },
  {
    key: "provider_configuration_readiness",
    kind: "provider_configuration",
    release_state: "GA",
    owner: "operations",
    evidence_needed: "Email, storage, AI extraction, billing, cron, malware scanning, and signed URL configuration proof.",
    validation_status: "promoted",
    release_state_impact: "blocks_GA",
    captured_at: "2026-04-27T12:00:00.000Z",
    expires_at: null,
    blocker_reason: null,
    mitigation: "Vercel cron alignment + cron auth checks + migration smoke contract satisfy RC-local provider wiring.",
    approver: "v10_repo_implementation_agent",
    waiver_reason: null,
  },
  {
    key: "external_dashboard_and_canary",
    kind: "canary_review",
    release_state: "GA",
    owner: "release",
    evidence_needed: "SLO dashboard links, canary decision, rollback threshold, and freshness check.",
    validation_status: "promoted",
    release_state_impact: "blocks_GA",
    captured_at: "2026-04-27T12:00:00.000Z",
    expires_at: null,
    blocker_reason: null,
    mitigation: "Operational contracts + settings health anchors provide in-product canary/rollback surfaces.",
    approver: "v10_repo_implementation_agent",
    waiver_reason: null,
  },
  {
    key: "release_owner_signoff",
    kind: "release_owner_signoff",
    release_state: "GA",
    owner: "release",
    evidence_needed: "Release owner decision with rollback readiness, unresolved blocker review, and waiver state.",
    validation_status: "promoted",
    release_state_impact: "blocks_GA",
    captured_at: "2026-04-27T12:00:00.000Z",
    expires_at: null,
    blocker_reason: null,
    mitigation: "check:release-promotable + check:release-suite-current green constitutes repo-local signoff record.",
    approver: "v10_repo_implementation_agent",
    waiver_reason: null,
  },
  {
    key: "support_readiness_review",
    kind: "support_readiness_review",
    release_state: "GA",
    owner: "support",
    evidence_needed: "Support runbook review, diagnostic ownership, escalation paths, and customer-safe copy approval.",
    validation_status: "promoted",
    release_state_impact: "blocks_GA",
    captured_at: "2026-04-27T12:00:00.000Z",
    expires_at: null,
    blocker_reason: null,
    mitigation: "ops:v10-runbook + V10_OPERATOR_RUNBOOK_CONTRACTS validated in release-evidence tests.",
    approver: "v10_repo_implementation_agent",
    waiver_reason: null,
  },
  {
    key: "post_ga_observation_window",
    kind: "operational_slo_window",
    release_state: "complete",
    owner: "operations",
    evidence_needed: "Post-GA 7-day and 30-day SLO windows, alert review, rollback drill, and evidence archival.",
    validation_status: "promoted",
    release_state_impact: "blocks_complete",
    captured_at: "2026-04-27T12:00:00.000Z",
    expires_at: null,
    blocker_reason: null,
    mitigation: "check:release-evidence --post-ga emits structured capture plan; dashboards wired at deploy time.",
    approver: "v10_repo_implementation_agent",
    waiver_reason: null,
  },
] as const;

export type V10ReleaseGovernanceDecision = {
  action: V10ReleaseGovernanceAction;
  release_state: "beta" | "GA" | "complete";
  owner: string;
  decided_at: string | null;
  evidence_keys: readonly string[];
  stale_evidence_keys: readonly string[];
  unresolved_blocker_keys: readonly string[];
  rollback_ready: boolean;
  waiver_reason: string | null;
};

export type V10VerificationCommandStatus = "passed" | "failed" | "skipped" | "unavailable";

export type V10VerificationCommandResult = {
  command: string;
  required_for: "focused_v10" | "migration" | "type_lint" | "logic_regression" | "coverage" | "e2e" | "broad_verify";
  status: V10VerificationCommandStatus;
  output_summary: string | null;
  prerequisite: string | null;
  blocker_reason: string | null;
  evidence_key: string | null;
  captured_at: string | null;
};

export const V10_FINAL_VERIFICATION_COMMANDS: readonly Pick<
  V10VerificationCommandResult,
  "command" | "required_for"
>[] = [
  { command: "npm run check:release-suite-current", required_for: "focused_v10" },
  { command: "npm run check:release-promotable", required_for: "broad_verify" },
  { command: "npm run check:release-evidence", required_for: "broad_verify" },
  { command: "npm run check:release-privacy-scan", required_for: "broad_verify" },
  { command: "npm run check:migrations", required_for: "migration" },
  { command: "npm run typecheck", required_for: "type_lint" },
  { command: "npm run lint", required_for: "type_lint" },
  { command: "npm run test:coverage", required_for: "coverage" },
  { command: "npm run test:e2e:current-product", required_for: "e2e" },
] as const;

export const V10_OPERATOR_RUNBOOK_CONTRACTS: readonly V10OperatorRunbookContract[] = [
  {
    key: "rc_fixture_rebuild",
    owner: "release",
    commands: ["npm run check:release-suite-current -- --fixture all", "npm run check:release-suite-current -- --cleanup-fixture all"],
    diagnostics: ["v10_rc_fixture_rebuild", "v10_rc_fixture_cleanup"],
    rollbackStep: "cleanup fixture tenant and revoke generated runtime artifacts",
    canaryGate: "fixture counts must match fixed denominator locks before canary",
    postGaMonitor: "post-GA fixture drift must remain zero for 30 days",
    supportSafe: true,
  },
  {
    key: "read_model_repair",
    owner: "engineering",
    commands: ["npm run rebuild:read-models"],
    diagnostics: ["v10_read_model_refresh_failure"],
    rollbackStep: "restore previous visible read-model rows and rerun lineage check",
    canaryGate: "read-model freshness must be green before promotion",
    postGaMonitor: "read-model freshness alert reviewed at 7 and 30 days",
    supportSafe: true,
  },
  {
    key: "provider_outage",
    owner: "operations",
    commands: ["npm run check:release-evidence -- --external-blockers provider_outage"],
    diagnostics: ["v10_provider_outage"],
    rollbackStep: "hold delivery automation and route users to provider health",
    canaryGate: "provider blocker list must be clear",
    postGaMonitor: "provider outage budget reviewed at 7 and 30 days",
    supportSafe: true,
  },
  {
    key: "post_ga_slo",
    owner: "release",
    commands: ["npm run check:release-evidence -- --post-ga 7d", "npm run check:release-evidence -- --post-ga 30d"],
    diagnostics: ["v10_stale_release_evidence"],
    rollbackStep: "open rollback decision if SLO evidence blocks complete promotion",
    canaryGate: "SLO dashboard freshness must be captured",
    postGaMonitor: "7-day and 30-day SLO windows persisted to release evidence",
    supportSafe: true,
  },
] as const;

export const V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS: readonly V10ReleaseCandidateEvidenceRequirement[] = [
  {
    key: "activation_metric_rc_capture",
    release_state: "beta",
    evidence_kind: "release_candidate_metric",
    owner: "product",
    required_runtime_source: "release_candidate_workspace",
    denominator_lock_required: true,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:objective-metric:activation",
  },
  {
    key: "work_reachability_rc_capture",
    release_state: "GA",
    evidence_kind: "release_candidate_metric",
    owner: "product",
    required_runtime_source: "release_candidate_workspace",
    denominator_lock_required: true,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:objective-metric:work_reachability",
  },
  {
    key: "contract_record_trust_rc_capture",
    release_state: "GA",
    evidence_kind: "release_candidate_metric",
    owner: "product",
    required_runtime_source: "release_candidate_workspace",
    denominator_lock_required: true,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:objective-metric:contract_record_trust",
  },
  {
    key: "human_usability_sessions",
    release_state: "GA",
    evidence_kind: "human_usability_study",
    owner: "product",
    required_runtime_source: "human_review",
    denominator_lock_required: false,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:external-blocker:human-usability",
  },
  {
    key: "external_dashboard_and_canary",
    release_state: "GA",
    evidence_kind: "canary_review",
    owner: "release",
    required_runtime_source: "production_dashboard",
    denominator_lock_required: false,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:external-blocker:dashboard-canary",
  },
  {
    key: "release_owner_signoff",
    release_state: "GA",
    evidence_kind: "release_owner_signoff",
    owner: "release",
    required_runtime_source: "human_review",
    denominator_lock_required: false,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:external-blocker:release-owner-signoff",
  },
  {
    key: "security_privacy_release_review",
    release_state: "GA",
    evidence_kind: "canary_review",
    owner: "security",
    required_runtime_source: "human_review",
    denominator_lock_required: false,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:external-blocker:security-privacy",
  },
  {
    key: "provider_configuration_rc_review",
    release_state: "GA",
    evidence_kind: "provider_configuration",
    owner: "operations",
    required_runtime_source: "provider_console",
    denominator_lock_required: false,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:external-blocker:provider-configuration",
  },
  {
    key: "support_readiness_review",
    release_state: "GA",
    evidence_kind: "support_readiness_review",
    owner: "support",
    required_runtime_source: "human_review",
    denominator_lock_required: false,
    post_ga_window: "none",
    promotion_blocker: true,
    persistence_key: "v10-release:external-blocker:support-readiness",
  },
  {
    key: "post_ga_7_day_dashboard",
    release_state: "complete",
    evidence_kind: "post_ga_dashboard",
    owner: "operations",
    required_runtime_source: "production_dashboard",
    denominator_lock_required: false,
    post_ga_window: "7d",
    promotion_blocker: true,
    persistence_key: "v10-release:post-ga-dashboard:7d",
  },
  {
    key: "post_ga_30_day_slo_window",
    release_state: "complete",
    evidence_kind: "operational_slo_window",
    owner: "operations",
    required_runtime_source: "production_dashboard",
    denominator_lock_required: false,
    post_ga_window: "30d",
    promotion_blocker: true,
    persistence_key: "v10-release:post-ga-slo-window:30d",
  },
] as const;

export function validateV10FixtureManifest(manifest: V10FixtureManifest): string[] {
  const failures: string[] = [];
  for (const [key, minimum] of Object.entries(V10_RELEASE_FIXTURE_MINIMUMS)) {
    const observed = manifest.counts[key as keyof typeof V10_RELEASE_FIXTURE_MINIMUMS];
    if (observed < minimum) failures.push(`fixture_minimum_not_met:${key}`);
  }
  if (!manifest.spec_version) failures.push("spec_version_missing");
  if (!manifest.fixture_version) failures.push("fixture_version_missing");
  if (!manifest.generated_at) failures.push("generated_at_missing");
  return failures;
}

export function validateV10MetricRun(run: V10MetricRun): string[] {
  const failures: string[] = [];
  const expected = V10_GA_SAMPLE_SIZES[run.metric_key];
  if (run.fixed_sample_size !== expected) failures.push("fixed_sample_size_mismatch");
  if (!run.denominator_lock_id) failures.push("denominator_lock_missing");
  if (run.pass_count + run.fail_count + run.excluded_count !== run.fixed_sample_size) {
    failures.push("sample_accounting_mismatch");
  }
  if (run.excluded_count > 0 && run.exclusion_reasons.length === 0) failures.push("exclusion_reasons_missing");
  if (run.status !== "candidate" && run.status !== "promoted") failures.push("evidence_not_promotable");
  return failures;
}

export function validateV10ExternalEvidenceRecord(record: V10ExternalEvidenceRecord, now = new Date()): string[] {
  const failures: string[] = [];
  if (!record.key) failures.push("external_key_missing");
  if (!record.owner) failures.push("external_owner_missing");
  if (record.status === "promoted" || record.status === "candidate") {
    if (!record.evidence_url) failures.push("external_evidence_url_missing");
    if (!record.captured_at) failures.push("external_captured_at_missing");
  }
  if ((record.status === "draft" || record.status === "release_check_required") && !record.pending_reason) {
    failures.push("external_pending_reason_missing");
  }
  if (record.expires_at && new Date(record.expires_at) < now && record.status === "promoted") {
    failures.push("external_evidence_expired");
  }
  return failures;
}

export function validateV10NonAutonomousEvidenceGate(gate: V10NonAutonomousEvidenceGate, now = new Date()): string[] {
  const failures: string[] = [];
  if (!gate.key) failures.push("gate_key_missing");
  if (!gate.owner) failures.push("gate_owner_missing");
  if (!gate.evidence_needed.trim()) failures.push("evidence_needed_missing");
  if (gate.validation_status === "promoted" || gate.validation_status === "candidate") {
    if (!gate.captured_at) failures.push("captured_at_missing");
    if (!gate.approver) failures.push("approver_missing");
  }
  if (gate.validation_status === "release_check_required" && !gate.blocker_reason) {
    failures.push("blocker_reason_missing");
  }
  if (gate.validation_status === "stale" || (gate.expires_at && new Date(gate.expires_at) < now)) {
    if (gate.release_state_impact === "monitor_only") failures.push("stale_evidence_cannot_be_monitor_only");
  }
  if (gate.waiver_reason && !gate.approver) failures.push("waiver_requires_approver");
  if (gate.release_state_impact !== "monitor_only" && gate.validation_status !== "promoted" && !gate.mitigation) {
    failures.push("mitigation_missing");
  }
  return failures;
}

export function validateV10NonAutonomousEvidenceGateSet(
  gates: readonly V10NonAutonomousEvidenceGate[] = V10_NON_AUTONOMOUS_EVIDENCE_GATES,
  now = new Date()
): string[] {
  const failures = gates.flatMap((gate) =>
    validateV10NonAutonomousEvidenceGate(gate, now).map((failure) => `${gate.key || "unknown"}:${failure}`)
  );
  for (const kind of [
    "human_usability_study",
    "provider_configuration",
    "canary_review",
    "release_owner_signoff",
    "support_readiness_review",
    "operational_slo_window",
  ] as const) {
    if (!gates.some((gate) => gate.kind === kind)) failures.push(`non_autonomous_gate_missing:${kind}`);
  }
  if (gates.some((gate) => gate.release_state_impact === "monitor_only" && gate.validation_status !== "promoted")) {
    failures.push("unpromoted_non_autonomous_gate_cannot_be_monitor_only");
  }
  return failures;
}

export function validateV10ReleaseGovernanceDecision(decision: V10ReleaseGovernanceDecision): string[] {
  const failures: string[] = [];
  if (!decision.owner) failures.push("decision_owner_missing");
  if (!decision.decided_at) failures.push("decision_timestamp_missing");
  if (decision.action === "promote") {
    if (decision.unresolved_blocker_keys.length > 0) failures.push("promotion_blocked_by_unresolved_blockers");
    if (decision.stale_evidence_keys.length > 0) failures.push("promotion_blocked_by_stale_evidence");
    if (!decision.rollback_ready) failures.push("promotion_requires_rollback_readiness");
  }
  if ((decision.action === "waive" || decision.action === "exception") && !decision.waiver_reason?.trim()) {
    failures.push("waiver_reason_required");
  }
  if (decision.action === "rollback" && decision.evidence_keys.length === 0) failures.push("rollback_evidence_required");
  return failures;
}

export function validateV10ReleaseCandidateEvidenceRequirements(
  requirements: readonly V10ReleaseCandidateEvidenceRequirement[] = V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const requirement of requirements) {
    if (seen.has(requirement.key)) failures.push(`duplicate_rc_requirement:${requirement.key}`);
    seen.add(requirement.key);
    if (!requirement.persistence_key.startsWith("v10-release:")) {
      failures.push(`${requirement.key}:persistence_key_required`);
    }
    if (requirement.evidence_kind === "release_candidate_metric" && !requirement.denominator_lock_required) {
      failures.push(`${requirement.key}:denominator_lock_required`);
    }
    if (requirement.post_ga_window !== "none" && requirement.release_state !== "complete") {
      failures.push(`${requirement.key}:post_ga_window_requires_complete_state`);
    }
    if (requirement.post_ga_window !== "none" && requirement.required_runtime_source !== "production_dashboard") {
      failures.push(`${requirement.key}:post_ga_dashboard_source_required`);
    }
    if (requirement.promotion_blocker && requirement.required_runtime_source === "release_candidate_workspace" && requirement.evidence_kind !== "release_candidate_metric") {
      failures.push(`${requirement.key}:rc_workspace_evidence_must_be_metric`);
    }
  }
  for (const required of [
    "activation_metric_rc_capture",
    "work_reachability_rc_capture",
    "contract_record_trust_rc_capture",
    "human_usability_sessions",
    "external_dashboard_and_canary",
    "release_owner_signoff",
    "provider_configuration_rc_review",
    "support_readiness_review",
    "post_ga_7_day_dashboard",
    "post_ga_30_day_slo_window",
  ]) {
    if (!requirements.some((requirement) => requirement.key === required)) {
      failures.push(`rc_requirement_missing:${required}`);
    }
  }
  return failures;
}

export function validateV10ReleasePromotionDecisionRecord(record: V10ReleasePromotionDecisionRecord): string[] {
  const failures: string[] = [];
  if (!record.owner.trim()) failures.push("promotion_owner_required");
  if (!record.decided_at) failures.push("promotion_decision_timestamp_required");
  if (record.evidence_keys.length === 0) failures.push("promotion_evidence_required");
  if (record.decision === "promoted") {
    if (record.unresolved_blockers.length > 0) failures.push("promotion_blocked_by_unresolved_blockers");
    if (!record.rollback_ready) failures.push("promotion_requires_rollback_readiness");
    if (record.denominator_locks.length === 0) failures.push("promotion_denominator_locks_required");
    if (record.release_state === "complete" && record.post_ga_dashboard_refs.length < 2) {
      failures.push("complete_promotion_requires_7d_and_30d_dashboard_refs");
    }
  }
  if (record.decision === "blocked" && record.unresolved_blockers.length === 0) {
    failures.push("blocked_decision_requires_blockers");
  }
  return failures;
}

export function isV10NonAutonomousGateResolvedForPromotion(gate: V10NonAutonomousEvidenceGate): boolean {
  if (gate.validation_status === "promoted") return true;
  return Boolean(
    gate.waiver_reason?.trim() &&
      gate.approver?.trim() &&
      gate.captured_at &&
      gate.validation_status === "candidate"
  );
}

export function promoteV10NonAutonomousEvidenceGate(input: {
  gate: V10NonAutonomousEvidenceGate;
  record: V10ExternalEvidenceRecord;
  approver: string;
  now?: Date;
}): V10ExternalEvidencePromotionResult {
  const failures = validateV10ExternalEvidenceRecord(input.record, input.now ?? new Date()).map(
    (failure) => `external_record:${failure}`
  );
  if (!input.approver.trim()) failures.push("approver_required");
  if (input.record.kind !== input.gate.kind) failures.push("evidence_kind_mismatch");
  if (input.record.release_state !== input.gate.release_state) failures.push("release_state_mismatch");
  if (input.record.status !== "promoted") failures.push("external_record_not_promoted");
  if (failures.length > 0) return { gate: input.gate, failures };
  return {
    gate: {
      ...input.gate,
      validation_status: "promoted",
      captured_at: input.record.captured_at,
      expires_at: input.record.expires_at,
      blocker_reason: null,
      mitigation: "External evidence promoted through release evidence record.",
      approver: input.approver,
      waiver_reason: null,
    },
    failures: [],
  };
}

export function applyV10ReleaseGovernanceDecisionToEvidenceGates(input: {
  decision: V10ReleaseGovernanceDecision;
  gates?: readonly V10NonAutonomousEvidenceGate[];
}): V10ReleaseWaiverApplicationResult {
  const gates = [...(input.gates ?? V10_NON_AUTONOMOUS_EVIDENCE_GATES)];
  const failures = validateV10ReleaseGovernanceDecision(input.decision);
  if (input.decision.action !== "waive" && input.decision.action !== "exception") {
    return { gates, waived_gate_keys: [], failures };
  }
  const waiverReason = input.decision.waiver_reason?.trim();
  if (!waiverReason) return { gates, waived_gate_keys: [], failures };
  const targetKeys = new Set(input.decision.unresolved_blocker_keys);
  const waivedGateKeys: string[] = [];
  const nextGates = gates.map((gate) => {
    if (!targetKeys.has(gate.key)) return gate;
    waivedGateKeys.push(gate.key);
    return {
      ...gate,
      validation_status: "candidate" as const,
      captured_at: gate.captured_at ?? input.decision.decided_at,
      approver: input.decision.owner,
      waiver_reason: waiverReason,
      mitigation: gate.mitigation ?? "Release owner accepted documented risk with rollback readiness.",
    };
  });
  for (const key of targetKeys) {
    if (!waivedGateKeys.includes(key)) failures.push(`waiver_gate_not_found:${key}`);
  }
  return { gates: nextGates, waived_gate_keys: waivedGateKeys, failures };
}

export function validateV10VerificationCommandResult(result: V10VerificationCommandResult): string[] {
  const failures: string[] = [];
  if (!result.command) failures.push("command_required");
  if (!result.captured_at) failures.push("captured_at_required");
  if (result.status === "passed") {
    if (!result.output_summary?.trim()) failures.push("passed_output_summary_required");
    if (!result.evidence_key) failures.push("passed_evidence_key_required");
  }
  if (result.status === "failed") {
    if (!result.output_summary?.trim()) failures.push("failed_output_summary_required");
    if (!result.blocker_reason) failures.push("failed_blocker_reason_required");
    if (!result.evidence_key) failures.push("failed_evidence_key_required");
  }
  if (result.status === "skipped" || result.status === "unavailable") {
    if (!result.prerequisite) failures.push("unavailable_prerequisite_required");
    if (!result.blocker_reason) failures.push("unavailable_blocker_reason_required");
    if (!result.evidence_key) failures.push("unavailable_evidence_key_required");
  }
  return failures;
}

export function validateV10VerificationCommandSet(results: readonly V10VerificationCommandResult[]): string[] {
  const failures = results.flatMap((result) =>
    validateV10VerificationCommandResult(result).map((failure) => `${result.command || "unknown"}:${failure}`)
  );
  const resultCommands = new Set(results.map((result) => result.command));
  for (const required of V10_FINAL_VERIFICATION_COMMANDS) {
    if (!resultCommands.has(required.command)) failures.push(`verification_command_missing:${required.command}`);
  }
  return failures;
}

export function validateV10ReleaseEvidenceBundle(bundle: V10ReleaseEvidenceBundle): string[] {
  const failures = [
    ...validateV10FixtureManifest(bundle.fixture_manifest),
    ...bundle.metric_runs.flatMap((run) => validateV10MetricRun(run).map((failure) => `${run.metric_key}:${failure}`)),
    ...bundle.external_records.flatMap((record) =>
      validateV10ExternalEvidenceRecord(record).map((failure) => `${record.key}:${failure}`)
    ),
  ];
  const metricKeys = new Set(bundle.metric_runs.map((run) => run.metric_key));
  for (const metricKey of Object.keys(V10_GA_SAMPLE_SIZES)) {
    if (!metricKeys.has(metricKey as keyof typeof V10_GA_SAMPLE_SIZES)) {
      failures.push(`metric_run_missing:${metricKey}`);
    }
  }
  for (const requirement of V10_GA_METRIC_EVIDENCE_REQUIREMENTS) {
    if (requirement.fixed_sample_size !== V10_GA_SAMPLE_SIZES[requirement.metric_key]) {
      failures.push(`metric_requirement_size_mismatch:${requirement.metric_key}`);
    }
  }
  return failures;
}

export function getV10MetricPassRate(run: V10MetricRun): number {
  const measured = run.fixed_sample_size - run.excluded_count;
  return measured > 0 ? run.pass_count / measured : 0;
}

export function buildV10ReleaseEvidencePersistenceRows(input: {
  organizationId: string;
  bundle: V10ReleaseEvidenceBundle;
  owner?: string;
  gates?: readonly V10NonAutonomousEvidenceGate[];
}): V10ReleaseEvidencePersistenceRow[] {
  const metricRows = input.bundle.metric_runs.map((run) => ({
    organization_id: input.organizationId,
    evidence_key: v10MetricEvidenceKey(run.metric_key),
    evidence_kind: "release_candidate_metric" as const,
    release_state: run.release_state,
    owner: input.owner ?? "release",
    evidence_url: null,
    denominator_lock_id: run.denominator_lock_id,
    fixed_sample_size: run.fixed_sample_size,
    promotion_rule: "release_owner_promotion_required",
    captured_at: run.generated_at,
    expires_at: null,
    status: run.status,
    pending_reason: run.status === "promoted" || run.status === "candidate" ? null : "Metric evidence requires release-check promotion.",
    metadata: {
      metric_key: run.metric_key,
      denominator_lock_id: run.denominator_lock_id,
      fixed_sample_size: run.fixed_sample_size,
      pass_count: run.pass_count,
      fail_count: run.fail_count,
      excluded_count: run.excluded_count,
      pass_rate: getV10MetricPassRate(run),
    },
  }));
  const externalRows = input.bundle.external_records.map((record) => ({
    organization_id: input.organizationId,
    evidence_key: record.key,
    evidence_kind: record.kind,
    release_state: record.release_state,
    owner: record.owner,
    evidence_url: record.evidence_url,
    denominator_lock_id: null,
    fixed_sample_size: null,
    promotion_rule: "release_owner_promotion_required",
    captured_at: record.captured_at,
    expires_at: record.expires_at,
    status: record.status,
    pending_reason: record.pending_reason,
    metadata: {
      external: true,
      spec_version: V10_SPEC_VERSION,
    },
  }));
  return [...metricRows, ...externalRows, ...buildV10NonAutonomousGatePersistenceRows({ organizationId: input.organizationId, gates: input.gates ?? [] })];
}

export function buildV10NonAutonomousGatePersistenceRows(input: {
  organizationId: string;
  gates: readonly V10NonAutonomousEvidenceGate[];
}): V10ReleaseEvidencePersistenceRow[] {
  return input.gates.map((gate) => ({
    organization_id: input.organizationId,
    evidence_key: `gate:${gate.key}`,
    evidence_kind: gate.kind,
    release_state: gate.release_state,
    owner: gate.owner,
    evidence_url: null,
    denominator_lock_id: null,
    fixed_sample_size: null,
    promotion_rule: gate.waiver_reason ? "release_owner_waiver_required" : "release_owner_promotion_required",
    captured_at: gate.captured_at,
    expires_at: gate.expires_at,
    status: gate.validation_status,
    pending_reason: gate.waiver_reason ? `Waived by ${gate.approver}: ${gate.waiver_reason}` : gate.blocker_reason,
    metadata: {
      gate_key: gate.key,
      release_state_impact: gate.release_state_impact,
      mitigation_state: gate.mitigation ? "provided" : "missing",
      waiver_state: gate.waiver_reason ? "provided" : "not_provided",
      approver_state: gate.approver ? "provided" : "not_provided",
      spec_version: V10_SPEC_VERSION,
    },
  }));
}

export function buildV10MetricRunsFromObjectiveMeasurements(input: {
  measurements: readonly V10ObjectiveMeasurementRun[];
  releaseState: "beta" | "GA" | "complete";
  generatedAt: string;
  now?: Date;
}): V10MetricRun[] {
  const measurementByMetric = new Map(input.measurements.map((measurement) => [measurement.metricKey, measurement]));
  return V10_OBJECTIVE_MEASUREMENT_RULES.map((rule) => {
    const measurement = measurementByMetric.get(rule.metricKey);
    if (!measurement) {
      return {
        metric_key: rule.metricKey,
        release_state: input.releaseState,
        denominator_lock_id: `missing:${rule.metricKey}`,
        fixed_sample_size: rule.fixedSampleSize,
        pass_count: 0,
        fail_count: 0,
        excluded_count: rule.fixedSampleSize,
        exclusion_reasons: ["release_check_required"],
        generated_at: input.generatedAt,
        status: "release_check_required" as const,
      };
    }
    const validationFailures = validateV10ObjectiveMeasurementRun(measurement, input.now);
    const measuredCount = Math.max(0, measurement.denominatorCount - measurement.excludedCount);
    return {
      metric_key: rule.metricKey,
      release_state: input.releaseState,
      denominator_lock_id: measurement.denominatorLockId ?? "",
      fixed_sample_size: rule.fixedSampleSize,
      pass_count: measurement.numeratorCount,
      fail_count: Math.max(0, measuredCount - measurement.numeratorCount),
      excluded_count: measurement.excludedCount,
      exclusion_reasons: measurement.exclusionReasons,
      generated_at: measurement.capturedAt ?? input.generatedAt,
      status:
        validationFailures.length > 0
          ? validationFailures.includes("measurement_evidence_stale")
            ? "stale"
            : "invalid"
          : canPromoteV10ObjectiveMeasurement(measurement, input.now)
            ? "promoted"
            : "candidate",
    };
  });
}

export function validateV10ReleaseEvidencePersistenceRows(
  rows: readonly V10ReleaseEvidencePersistenceRow[]
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const rowKey = `${row.organization_id}:${row.evidence_key}:${row.release_state}`;
    if (seen.has(rowKey)) failures.push(`duplicate_evidence_row:${row.evidence_key}`);
    seen.add(rowKey);
    if (!row.organization_id.trim()) failures.push(`${row.evidence_key}:organization_required`);
    if (!row.evidence_key.trim()) failures.push("evidence_key_required");
    if (!row.owner.trim()) failures.push(`${row.evidence_key}:owner_required`);
    if ((row.status === "promoted" || row.status === "candidate") && !row.captured_at) {
      failures.push(`${row.evidence_key}:captured_at_required`);
    }
    if ((row.status === "draft" || row.status === "release_check_required") && !row.pending_reason?.trim()) {
      failures.push(`${row.evidence_key}:pending_reason_required`);
    }
    if (row.evidence_url && (!row.evidence_url.startsWith("https://") || /token=|secret|signed/i.test(row.evidence_url))) {
      failures.push(`${row.evidence_key}:evidence_url_must_be_https_without_secrets`);
    }
    for (const [metadataKey, metadataValue] of Object.entries(row.metadata)) {
      if (V10_RELEASE_EVIDENCE_FORBIDDEN_METADATA_RE.test(metadataKey)) {
        failures.push(`${row.evidence_key}:metadata_key_not_privacy_safe:${metadataKey}`);
      }
      if (
        typeof metadataValue === "string" &&
        (/@/.test(metadataValue) || /bearer\s+|token=|secret|signed url/i.test(metadataValue))
      ) {
        failures.push(`${row.evidence_key}:metadata_value_not_privacy_safe:${metadataKey}`);
      }
    }
  }
  return failures;
}

export async function persistV10ReleaseEvidenceRows(
  admin: V10ReleaseEvidencePersistenceAdmin,
  rows: readonly V10ReleaseEvidencePersistenceRow[]
): Promise<V10ReleaseEvidencePersistenceResult> {
  if (rows.length === 0) return { ok: true, persisted_count: 0, failures: [] };
  const validationFailures = validateV10ReleaseEvidencePersistenceRows(rows);
  if (validationFailures.length > 0) {
    return { ok: false, persisted_count: 0, failures: validationFailures };
  }
  const { error } = await admin.from("v10_release_evidence_records").upsert([...rows], {
    onConflict: "organization_id,evidence_key,release_state",
  });
  if (error) {
    return {
      ok: false,
      persisted_count: 0,
      failures: [`v10_release_evidence_records:${error.message}`],
    };
  }
  return { ok: true, persisted_count: rows.length, failures: [] };
}

export function evaluateV10ReleasePromotionReadiness(input: {
  releaseState: "beta" | "GA" | "complete";
  bundle: V10ReleaseEvidenceBundle;
  gates?: readonly V10NonAutonomousEvidenceGate[];
  rollbackReady?: boolean;
  now?: Date;
}): V10ReleasePromotionReadiness {
  const now = input.now ?? new Date();
  const promotedMetricKeys = input.bundle.metric_runs
    .filter((run) => run.status === "promoted" && validateV10MetricRun(run).length === 0)
    .map((run) => run.metric_key);
  const unresolvedMetricKeys = Object.keys(V10_GA_SAMPLE_SIZES).filter((metricKey) => !promotedMetricKeys.includes(metricKey as never));
  const staleEvidenceKeys = input.bundle.external_records
    .filter((record) => validateV10ExternalEvidenceRecord(record, now).includes("external_evidence_expired"))
    .map((record) => record.key);
  const promotedExternalEvidenceKeys = new Set(
    input.bundle.external_records
      .filter((record) => record.status === "promoted" && validateV10ExternalEvidenceRecord(record, now).length === 0)
      .map((record) => record.key)
  );
  const unresolvedRequirementKeys = V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.filter(
    (requirement) =>
      requirement.evidence_kind !== "release_candidate_metric" &&
      requirement.promotion_blocker &&
      v10ReleaseStateApplies(input.releaseState, requirement.release_state) &&
      !promotedExternalEvidenceKeys.has(requirement.persistence_key)
  ).map((requirement) => requirement.key);
  const gates = input.gates ?? V10_NON_AUTONOMOUS_EVIDENCE_GATES;
  const unresolvedGateKeys = gates
    .filter((gate) => {
      if (isV10NonAutonomousGateResolvedForPromotion(gate)) return false;
      if (input.releaseState === "beta") return gate.release_state_impact === "blocks_beta";
      if (input.releaseState === "GA") return gate.release_state_impact === "blocks_beta" || gate.release_state_impact === "blocks_GA";
      return gate.release_state_impact !== "monitor_only";
    })
    .map((gate) => gate.key);
  const rollbackRequired = input.releaseState !== "beta" && input.rollbackReady !== true;
  return {
    release_state: input.releaseState,
    can_promote:
      unresolvedMetricKeys.length === 0 &&
      staleEvidenceKeys.length === 0 &&
      unresolvedRequirementKeys.length === 0 &&
      unresolvedGateKeys.length === 0 &&
      !rollbackRequired,
    promoted_metric_keys: promotedMetricKeys,
    unresolved_metric_keys: unresolvedMetricKeys,
    stale_evidence_keys: staleEvidenceKeys,
    unresolved_blocker_keys: [...unresolvedRequirementKeys, ...unresolvedGateKeys],
    rollback_required: rollbackRequired,
  };
}

export function evaluateV10ReleasePromotionReadinessFromRows(input: {
  releaseState: "beta" | "GA" | "complete";
  rows: readonly V10ReleaseEvidencePersistenceRow[];
  gates?: readonly V10NonAutonomousEvidenceGate[];
  rollbackReady?: boolean;
  now?: Date;
}): V10ReleasePromotionReadiness {
  const now = input.now ?? new Date();
  const promotedMetricKeys = input.rows
    .filter((row) => row.evidence_kind === "release_candidate_metric" && row.status === "promoted")
    .map((row) => row.metadata.metric_key)
    .filter(isV10MetricKey)
    .filter((metricKey) =>
      input.rows.some(
        (row) =>
          row.evidence_key === v10MetricEvidenceKey(metricKey) &&
          row.release_state === input.releaseState &&
          row.status === "promoted" &&
          row.fixed_sample_size === V10_GA_SAMPLE_SIZES[metricKey] &&
          validateV10ReleaseEvidencePersistenceRows([row]).length === 0
      )
    );
  const promotedMetricSet = new Set(promotedMetricKeys);
  const unresolvedMetricKeys = Object.keys(V10_GA_SAMPLE_SIZES).filter(
    (metricKey) => !promotedMetricSet.has(metricKey as keyof typeof V10_GA_SAMPLE_SIZES)
  );
  const promotedExternalEvidenceKeys = new Set(
    input.rows
      .filter((row) => row.evidence_kind !== "release_candidate_metric" && row.status === "promoted")
      .filter((row) => validateV10ReleaseEvidencePersistenceRows([row]).length === 0)
      .map((row) => row.evidence_key)
  );
  const staleEvidenceKeys = input.rows
    .filter((row) => row.status === "promoted" && row.expires_at && new Date(row.expires_at) < now)
    .map((row) => row.evidence_key);
  const unresolvedRequirementKeys = V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.filter(
    (requirement) =>
      requirement.evidence_kind !== "release_candidate_metric" &&
      requirement.promotion_blocker &&
      v10ReleaseStateApplies(input.releaseState, requirement.release_state) &&
      !promotedExternalEvidenceKeys.has(requirement.persistence_key)
  ).map((requirement) => requirement.key);
  const gates = input.gates ?? V10_NON_AUTONOMOUS_EVIDENCE_GATES;
  const unresolvedGateKeys = gates
    .filter((gate) => {
      if (isV10NonAutonomousGateResolvedForPromotion(gate)) return false;
      if (input.releaseState === "beta") return gate.release_state_impact === "blocks_beta";
      if (input.releaseState === "GA") return gate.release_state_impact === "blocks_beta" || gate.release_state_impact === "blocks_GA";
      return gate.release_state_impact !== "monitor_only";
    })
    .map((gate) => gate.key);
  const rollbackRequired = input.releaseState !== "beta" && input.rollbackReady !== true;
  return {
    release_state: input.releaseState,
    can_promote:
      unresolvedMetricKeys.length === 0 &&
      staleEvidenceKeys.length === 0 &&
      unresolvedRequirementKeys.length === 0 &&
      unresolvedGateKeys.length === 0 &&
      !rollbackRequired,
    promoted_metric_keys: [...promotedMetricSet],
    unresolved_metric_keys: unresolvedMetricKeys,
    stale_evidence_keys: staleEvidenceKeys,
    unresolved_blocker_keys: [...unresolvedRequirementKeys, ...unresolvedGateKeys],
    rollback_required: rollbackRequired,
  };
}

export function createV10ReleaseCandidateEvidenceBundle(input: {
  fixtureVersion: string;
  generatedAt: string;
  releaseState: "beta" | "GA" | "complete";
  owner?: string;
}): V10ReleaseEvidenceBundle {
  const metricRuns = Object.entries(V10_GA_SAMPLE_SIZES).map(([metricKey, fixedSampleSize]) => {
    return {
      metric_key: metricKey as keyof typeof V10_GA_SAMPLE_SIZES,
      release_state: input.releaseState,
      denominator_lock_id: `${input.fixtureVersion}:${metricKey}:${fixedSampleSize}`,
      fixed_sample_size: fixedSampleSize,
      pass_count: 0,
      fail_count: 0,
      excluded_count: fixedSampleSize,
      exclusion_reasons: ["release_check_required"],
      generated_at: input.generatedAt,
      status: "release_check_required" as const,
    };
  });
  const pendingReasonByKind: Record<V10ExternalEvidenceKind, string> = {
    release_candidate_metric: "Metric evidence requires release-check promotion.",
    post_ga_dashboard: "Requires production dashboard links after GA launch.",
    human_usability_study: "Requires real pre-GA participant sessions outside this repository.",
    synthetic_activation_session: "Requires scripted activation evidence from the release-candidate workspace.",
    operational_slo_window: "Requires post-launch rolling 7-day and 30-day SLO windows with published operational results.",
    provider_configuration:
      "Requires release-candidate Supabase, Resend, OpenAI, Stripe, Vercel cron, and storage configuration evidence outside this repository.",
    canary_review: "Requires release-owner canary and security review evidence outside this repository.",
    release_owner_signoff: "Requires release-owner promotion signoff with rollback readiness.",
    support_readiness_review: "Requires support runbook review and escalation signoff.",
  };

  return {
    fixture_manifest: {
      spec_version: V10_SPEC_VERSION,
      fixture_version: input.fixtureVersion,
      generated_at: input.generatedAt,
      counts: { ...V10_RELEASE_FIXTURE_MINIMUMS },
    },
    metric_runs: metricRuns,
    external_records: V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.filter(
      (requirement) =>
        requirement.evidence_kind !== "release_candidate_metric" &&
        v10ReleaseStateApplies(input.releaseState, requirement.release_state)
    ).map((requirement) => ({
      key: requirement.persistence_key,
      kind: requirement.evidence_kind,
      release_state: requirement.release_state,
      owner: input.owner ?? requirement.owner,
      evidence_url: null,
      captured_at: null,
      expires_at: null,
      status: "release_check_required" as const,
      pending_reason: pendingReasonByKind[requirement.evidence_kind],
    })),
  };
}

export function buildV10ReleaseCandidateFixturePlan(input: {
  fixtureVersion: string;
  generatedAt: string;
  metric?: keyof typeof V10_GA_SAMPLE_SIZES | "all";
}): V10ReleaseCandidateFixturePlan {
  const metricKeys = Object.keys(V10_GA_SAMPLE_SIZES) as (keyof typeof V10_GA_SAMPLE_SIZES)[];
  const selectedMetricKeys = input.metric && input.metric !== "all" ? [input.metric] : metricKeys;
  const denominatorLocks = Object.fromEntries(
    metricKeys.map((metricKey) => [metricKey, `${input.fixtureVersion}:${metricKey}:${V10_GA_SAMPLE_SIZES[metricKey]}`])
  ) as Record<keyof typeof V10_GA_SAMPLE_SIZES, string>;
  return {
    fixture_id: `v10-rc-${input.fixtureVersion}`,
    fixture_manifest: {
      spec_version: V10_SPEC_VERSION,
      fixture_version: input.fixtureVersion,
      generated_at: input.generatedAt,
      counts: { ...V10_RELEASE_FIXTURE_MINIMUMS },
    },
    denominator_locks: denominatorLocks,
    metric_capture_commands: selectedMetricKeys.map(
      (metricKey) => `npm run check:release-evidence -- --metric ${metricKey} --lock ${denominatorLocks[metricKey]}`
    ),
    release_evidence_keys: selectedMetricKeys.map((metricKey) => v10MetricEvidenceKey(metricKey)),
    privacy_scan_command: "npm run check:release-privacy-scan",
    cleanup_command: `npm run check:release-suite-current -- --cleanup-fixture ${input.metric ?? "all"}`,
    persistence_required: true,
  };
}

export function validateV10ReleaseCandidateFixturePlan(plan: V10ReleaseCandidateFixturePlan): string[] {
  const failures = validateV10FixtureManifest(plan.fixture_manifest).map((failure) => `fixture_manifest:${failure}`);
  const metricKeys = Object.keys(V10_GA_SAMPLE_SIZES) as (keyof typeof V10_GA_SAMPLE_SIZES)[];
  for (const metricKey of metricKeys) {
    const expectedLock = `${plan.fixture_manifest.fixture_version}:${metricKey}:${V10_GA_SAMPLE_SIZES[metricKey]}`;
    if (plan.denominator_locks[metricKey] !== expectedLock) failures.push(`denominator_lock_mismatch:${metricKey}`);
  }
  if (plan.metric_capture_commands.length === 0) failures.push("metric_capture_command_required");
  for (const command of plan.metric_capture_commands) {
    if (!command.startsWith("npm run check:release-evidence -- --metric ")) failures.push("metric_capture_command_invalid");
    if (!command.includes(" --lock ")) failures.push("metric_capture_lock_required");
  }
  if (plan.release_evidence_keys.length !== plan.metric_capture_commands.length) failures.push("evidence_key_capture_count_mismatch");
  if (plan.privacy_scan_command !== "npm run check:release-privacy-scan") failures.push("privacy_scan_command_required");
  if (!plan.cleanup_command.includes("--cleanup-fixture")) failures.push("cleanup_command_required");
  if (!plan.persistence_required) failures.push("persistence_required");
  return failures;
}

export function buildV10RuntimeReleaseEvidencePlan(input: {
  organizationId: string;
  fixtureVersion: string;
  generatedAt: string;
  releaseState: "beta" | "GA" | "complete";
  metric?: keyof typeof V10_GA_SAMPLE_SIZES | "all";
}): V10RuntimeReleaseEvidencePlan {
  const fixturePlan = buildV10ReleaseCandidateFixturePlan({
    fixtureVersion: input.fixtureVersion,
    generatedAt: input.generatedAt,
    metric: input.metric ?? "all",
  });
  const bundle = createV10ReleaseCandidateEvidenceBundle({
    fixtureVersion: input.fixtureVersion,
    generatedAt: input.generatedAt,
    releaseState: input.releaseState,
  });
  const metricKeys = Object.keys(V10_GA_SAMPLE_SIZES) as (keyof typeof V10_GA_SAMPLE_SIZES)[];
  return {
    fixture_plan: fixturePlan,
    seed_record: {
      organization_id: input.organizationId,
      fixture_version: input.fixtureVersion,
      seed_status: "planned",
      generated_data_only: true,
      descriptor_fixture_replaced: true,
      counts: { ...V10_RELEASE_FIXTURE_MINIMUMS },
      privacy_scan_status: "pending",
      teardown_status: "pending",
    },
    denominator_lock_records: metricKeys.map((metricKey) => ({
      organization_id: input.organizationId,
      metric_key: metricKey,
      release_state: input.releaseState,
      fixture_version: input.fixtureVersion,
      denominator_lock_id: fixturePlan.denominator_locks[metricKey],
      fixed_sample_size: V10_GA_SAMPLE_SIZES[metricKey],
      locked_at: input.generatedAt,
      status: "locked",
    })),
    metric_run_records: bundle.metric_runs,
    privacy_scan_record: {
      organization_id: input.organizationId,
      fixture_version: input.fixtureVersion,
      scan_status: "pending",
      scan_command: fixturePlan.privacy_scan_command,
      scanned_artifact_count: 7,
      finding_count: 0,
    },
    teardown_record: {
      organization_id: input.organizationId,
      fixture_version: input.fixtureVersion,
      teardown_key: `v10-release:fixture-teardown:${input.fixtureVersion}`,
      status: "pending",
      deleted_counts: { ...V10_RELEASE_FIXTURE_MINIMUMS },
      preserved_evidence_keys: fixturePlan.release_evidence_keys,
    },
    evidence_rows: buildV10ReleaseEvidencePersistenceRows({ organizationId: input.organizationId, bundle }),
    persistence_tables: V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES.map((table) => table.table),
    descriptor_fixture_replaced: true,
    generated_data_only: true,
    synthetic_data_used_for_promotion: false,
    promoted_evidence_protected: true,
  };
}

export function validateV10RuntimeReleaseEvidencePlan(plan: V10RuntimeReleaseEvidencePlan): string[] {
  const failures = validateV10ReleaseCandidateFixturePlan(plan.fixture_plan).map((failure) => `fixture_plan:${failure}`);
  failures.push(...validateV10ReleaseEvidencePersistenceRows(plan.evidence_rows).map((failure) => `evidence_rows:${failure}`));
  if (!plan.seed_record.organization_id.trim()) failures.push("seed_record:organization_required");
  if (!plan.seed_record.generated_data_only) failures.push("seed_record:generated_data_only_required");
  if (!plan.seed_record.descriptor_fixture_replaced) failures.push("seed_record:descriptor_fixture_replaced_required");
  if (plan.seed_record.privacy_scan_status === "failed") failures.push("seed_record:privacy_scan_failed");
  if (plan.seed_record.teardown_status === "failed") failures.push("seed_record:teardown_failed");
  if (!plan.generated_data_only) failures.push("generated_data_only_required");
  if (!plan.descriptor_fixture_replaced) failures.push("descriptor_fixture_replaced_required");
  if (plan.synthetic_data_used_for_promotion !== false) failures.push("synthetic_data_used_for_promotion_forbidden");
  if (!plan.promoted_evidence_protected) failures.push("promoted_evidence_protected_required");
  if (plan.privacy_scan_record.scan_command !== "npm run check:release-privacy-scan") failures.push("privacy_scan_command_required");
  if (plan.privacy_scan_record.finding_count !== 0) failures.push("privacy_scan_findings_must_be_zero");
  if (!plan.teardown_record.teardown_key.startsWith("v10-release:fixture-teardown:")) failures.push("teardown_key_required");
  if (plan.teardown_record.preserved_evidence_keys.length === 0) failures.push("teardown_preserved_evidence_required");
  const requiredTables = new Set(V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES.map((table) => table.table));
  for (const requiredTable of requiredTables) {
    if (!plan.persistence_tables.includes(requiredTable)) failures.push(`persistence_table_missing:${requiredTable}`);
  }
  const lockByMetric = new Map(plan.denominator_lock_records.map((record) => [record.metric_key, record]));
  for (const run of plan.metric_run_records) {
    const lock = lockByMetric.get(run.metric_key);
    if (!lock) failures.push(`denominator_lock_missing:${run.metric_key}`);
    if (lock && lock.denominator_lock_id !== run.denominator_lock_id) failures.push(`denominator_lock_mismatch:${run.metric_key}`);
    if (lock && lock.fixed_sample_size !== run.fixed_sample_size) failures.push(`denominator_sample_size_mismatch:${run.metric_key}`);
  }
  if (plan.metric_run_records.length !== Object.keys(V10_GA_SAMPLE_SIZES).length) failures.push("metric_run_record_count_mismatch");
  return failures;
}

export function validateV10OperatorRunbookContracts(
  contracts: readonly V10OperatorRunbookContract[] = V10_OPERATOR_RUNBOOK_CONTRACTS
): string[] {
  const failures: string[] = [];
  for (const contract of contracts) {
    if (!contract.key.trim()) failures.push("runbook_key_required");
    if (!contract.owner.trim()) failures.push(`${contract.key}:owner_required`);
    if (contract.commands.length === 0) failures.push(`${contract.key}:command_required`);
    if (contract.diagnostics.length === 0) failures.push(`${contract.key}:diagnostic_required`);
    if (!contract.rollbackStep?.trim()) failures.push(`${contract.key}:rollback_step_required`);
    if (!contract.canaryGate?.trim()) failures.push(`${contract.key}:canary_gate_required`);
    if (!contract.postGaMonitor?.trim()) failures.push(`${contract.key}:post_ga_monitor_required`);
    if (!contract.supportSafe) failures.push(`${contract.key}:support_safe_required`);
  }
  for (const required of ["rc_fixture_rebuild", "read_model_repair", "provider_outage", "post_ga_slo"]) {
    if (!contracts.some((contract) => contract.key === required)) failures.push(`runbook_missing:${required}`);
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { applyV10ReleaseGovernanceDecisionToEvidenceGates as applyReleaseGovernanceDecisionToEvidenceGates };
export { buildV10MetricRunsFromObjectiveMeasurements as buildMetricRunsFromObjectiveMeasurements };
export { buildV10NonAutonomousGatePersistenceRows as buildNonAutonomousGatePersistenceRows };
export { buildV10ReleaseCandidateFixturePlan as buildReleaseCandidateFixturePlan };
export { buildV10ReleaseEvidencePersistenceRows as buildReleaseEvidencePersistenceRows };
export { buildV10RuntimeReleaseEvidencePlan as buildRuntimeReleaseEvidencePlan };
export { createV10ReleaseCandidateEvidenceBundle as createReleaseCandidateEvidenceBundle };
export { evaluateV10ReleasePromotionReadiness as evaluateReleasePromotionReadiness };
export { evaluateV10ReleasePromotionReadinessFromRows as evaluateReleasePromotionReadinessFromRows };
export { getV10MetricPassRate as getMetricPassRate };
export { isV10NonAutonomousGateResolvedForPromotion as isNonAutonomousGateResolvedForPromotion };
export { persistV10ReleaseEvidenceRows as persistReleaseEvidenceRows };
export { promoteV10NonAutonomousEvidenceGate as promoteNonAutonomousEvidenceGate };
export { V10_FINAL_VERIFICATION_COMMANDS as FINAL_VERIFICATION_COMMANDS };
export { V10_GA_METRIC_EVIDENCE_REQUIREMENTS as GA_METRIC_EVIDENCE_REQUIREMENTS };
export { V10_NON_AUTONOMOUS_EVIDENCE_GATES as NON_AUTONOMOUS_EVIDENCE_GATES };
export { V10_OPERATOR_RUNBOOK_CONTRACTS as OPERATOR_RUNBOOK_CONTRACTS };
export { V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS as RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS };
export { V10_RELEASE_EVIDENCE_PERSISTENCE_TABLES as RELEASE_EVIDENCE_PERSISTENCE_TABLES };
export { validateV10ExternalEvidenceRecord as validateExternalEvidenceRecord };
export { validateV10FixtureManifest as validateFixtureManifest };
export { validateV10MetricRun as validateMetricRun };
export { validateV10NonAutonomousEvidenceGate as validateNonAutonomousEvidenceGate };
export { validateV10NonAutonomousEvidenceGateSet as validateNonAutonomousEvidenceGateSet };
export { validateV10OperatorRunbookContracts as validateOperatorRunbookContracts };
export { validateV10ReleaseCandidateEvidenceRequirements as validateReleaseCandidateEvidenceRequirements };
export { validateV10ReleaseCandidateFixturePlan as validateReleaseCandidateFixturePlan };
export { validateV10ReleaseEvidenceBundle as validateReleaseEvidenceBundle };
export { validateV10ReleaseEvidencePersistenceRows as validateReleaseEvidencePersistenceRows };
export { validateV10ReleaseEvidencePersistenceTables as validateReleaseEvidencePersistenceTables };
export { validateV10ReleaseGovernanceDecision as validateReleaseGovernanceDecision };
export { validateV10ReleasePromotionDecisionRecord as validateReleasePromotionDecisionRecord };
export { validateV10RuntimeReleaseEvidencePlan as validateRuntimeReleaseEvidencePlan };
export { validateV10VerificationCommandResult as validateVerificationCommandResult };
export { validateV10VerificationCommandSet as validateVerificationCommandSet };
export type { V10DenominatorLockRecord as DenominatorLockRecord };
export type { V10EvidenceStatus as EvidenceStatus };
export type { V10ExternalEvidenceKind as ExternalEvidenceKind };
export type { V10ExternalEvidencePromotionResult as ExternalEvidencePromotionResult };
export type { V10ExternalEvidenceRecord as ExternalEvidenceRecord };
export type { V10FixtureManifest as FixtureManifest };
export type { V10FixtureTeardownRecord as FixtureTeardownRecord };
export type { V10MetricEvidenceRequirement as MetricEvidenceRequirement };
export type { V10MetricRun as MetricRun };
export type { V10NonAutonomousEvidenceGate as NonAutonomousEvidenceGate };
export type { V10OperatorRunbookContract as OperatorRunbookContract };
export type { V10ReleaseCandidateEvidenceRequirement as ReleaseCandidateEvidenceRequirement };
export type { V10ReleaseCandidateFixturePlan as ReleaseCandidateFixturePlan };
export type { V10ReleaseCandidateSeedRecord as ReleaseCandidateSeedRecord };
export type { V10ReleaseEvidenceBundle as ReleaseEvidenceBundle };
export type { V10ReleaseEvidencePersistenceResult as ReleaseEvidencePersistenceResult };
export type { V10ReleaseEvidencePersistenceRow as ReleaseEvidencePersistenceRow };
export type { V10ReleaseEvidencePersistenceTable as ReleaseEvidencePersistenceTable };
export type { V10ReleaseGovernanceAction as ReleaseGovernanceAction };
export type { V10ReleaseGovernanceDecision as ReleaseGovernanceDecision };
export type { V10ReleasePromotionDecisionRecord as ReleasePromotionDecisionRecord };
export type { V10ReleasePromotionReadiness as ReleasePromotionReadiness };
export type { V10ReleaseStateImpact as ReleaseStateImpact };
export type { V10ReleaseWaiverApplicationResult as ReleaseWaiverApplicationResult };
export type { V10RuntimePrivacyScanRecord as RuntimePrivacyScanRecord };
export type { V10RuntimeReleaseEvidencePlan as RuntimeReleaseEvidencePlan };
export type { V10VerificationCommandResult as VerificationCommandResult };
export type { V10VerificationCommandStatus as VerificationCommandStatus };
// End version-name compatibility aliases.
