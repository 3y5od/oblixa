import {
  V10_MUTATION_CATALOG,
  getV10RoleRank,
  type V10MutationOutcome,
  type V10Role,
} from "./release-contract";

export type V10MutationName = (typeof V10_MUTATION_CATALOG)[number]["name"];
export type V10RuntimeMutationName = V10MutationName | keyof typeof V10_MUTATION_RUNTIME_ALIASES;

export type V10MutationRolloutContract = {
  mutationName: V10MutationName;
  legacyCompatible: boolean;
  idempotencyRequired: boolean;
  auditRequired: boolean;
  actorMustBeServerDerived: boolean;
  expectedVersionRequired: boolean;
};

export type V10RolloutState =
  | "disabled"
  | "internal_only"
  | "fixture_only"
  | "beta_canary"
  | "beta_broad"
  | "ga_candidate"
  | "ga"
  | "paused"
  | "rolled_back";

export type V10RolloutDecision = {
  allowed: boolean;
  outcome: V10MutationOutcome;
  reason: string | null;
  recoveryDestination: string;
};

export type V10RollbackReadinessInput = {
  rollbackState: V10RolloutState;
  rollbackRunbook: string | null;
  backfillVerified: boolean;
  readModelRebuildVerified: boolean;
  evidenceArchiveVerified: boolean;
  owner: string | null;
};

export type V10RuntimeArtifactKind =
  | "read_models"
  | "command_search_index"
  | "audit_events"
  | "release_evidence"
  | "report_export_artifacts"
  | "idempotency_rows"
  | "external_links";

export type V10RolloutOperationPhase =
  | "preflight"
  | "dry_run"
  | "incremental_backfill"
  | "verify"
  | "promote"
  | "rollback"
  | "stale_evidence_invalidation"
  | "kill_switch"
  | "post_run_report";

export type V10RuntimeArtifactOpsPlan = {
  artifactKind: V10RuntimeArtifactKind;
  owner: string;
  phases: readonly V10RolloutOperationPhase[];
  backfillMode: "none" | "incremental" | "full_rebuild" | "source_targeted_repair";
  repairTargets: readonly string[];
  rollbackSteps: readonly string[];
  retentionDays: number;
  diagnostics: readonly string[];
  disasterRecoveryActions: readonly string[];
};

export type V10BackfillRunbookManifest = {
  generatedAt: string;
  rolloutState: V10RolloutState;
  preflightCommands: readonly string[];
  backfillCommands: readonly string[];
  verificationCommands: readonly string[];
  rollbackCommands: readonly string[];
  requiredOwners: readonly string[];
  artifactKinds: readonly V10RuntimeArtifactKind[];
};

export type V10WorkspaceDowngradePlan = {
  transition: "advanced_to_core" | "assurance_to_advanced" | "assurance_to_core" | "plan_past_due";
  hideIneligibleRows: boolean;
  purgeRecentCommandLeakage: boolean;
  preserveAuditVisibility: boolean;
  suppressNotifications: boolean;
  readModelRepairRequired: boolean;
  recoveryDestination: string;
};

export type V10MigrationSafetyCheck = {
  checkKey: string;
  forwardOnly: boolean;
  idempotentDdl: boolean;
  grantsVerified: boolean;
  rlsVerified: boolean;
  indexesVerified: boolean;
  functionSecurityDefinerReviewed: boolean;
  rollbackPath: string;
};

export type V10MigrationRolloutSafetyPhase =
  | "additive_migration"
  | "idempotent_backfill"
  | "validation_gate"
  | "rollout_gate"
  | "canary"
  | "rollback"
  | "cleanup";

export type V10MigrationRolloutSafetyContract = {
  key: string;
  phase: V10MigrationRolloutSafetyPhase;
  protectedArtifacts: readonly string[];
  checks: readonly string[];
  rollbackPath: string | null;
  compatibilityBoundary: string | null;
  cleanupCheckpoint: string | null;
};

export const V10_MUTATION_ROLLOUT_CONTRACTS: readonly V10MutationRolloutContract[] =
  V10_MUTATION_CATALOG.map((mutation) => ({
    mutationName: mutation.name,
    legacyCompatible: true,
    idempotencyRequired: true,
    auditRequired: true,
    actorMustBeServerDerived: true,
    expectedVersionRequired: !["submit_external_evidence", "create_export_job"].includes(mutation.name),
  }));

export const V10_MUTATION_RUNTIME_ALIASES = {
  assign_owner: "assign_work_item_owner",
  bulk_assign: "bulk_assign_compatible_work_items",
  bulk_complete: "bulk_complete_compatible_work_items",
  edit_field: "edit_and_approve_field",
  create_evidence: "create_evidence_request",
  submit_evidence: "submit_external_evidence",
  approve_approval: "approve_approval_request",
  reject_approval: "reject_approval_request",
  request_changes: "request_approval_changes",
  "evidence.submit": "submit_external_evidence",
  "evidence.accept": "accept_evidence",
  "evidence.reject": "reject_evidence",
  "approval.approve": "approve_approval_request",
  "approval.reject": "reject_approval_request",
  "approval.request-changes": "request_approval_changes",
  "approval.request_changes": "request_approval_changes",
  "approval.delegate": "delegate_approval_request",
  "approval.escalate": "escalate_approval_request",
  "exception.assign": "assign_exception_owner",
  "exception.resolve": "resolve_exception",
  "exception.reopen": "reopen_exception",
  "renewal.complete": "change_renewal_posture",
  "renewal.reopen": "change_renewal_posture",
  "renewal.generate_decision_packet": "generate_renewal_decision_packet",
  "renewal.recommendation": "record_renewal_recommendation",
  "report_pack.create": "create_report_run",
  assignWorkItemOwner: "assign_work_item_owner",
  completeWorkItem: "complete_work_item",
  bulkAssignCompatibleContractTasks: "bulk_assign_compatible_work_items",
  bulkAssignCompatibleV10WorkItems: "bulk_assign_compatible_work_items",
  bulkCompleteCompatibleContractTasks: "bulk_complete_compatible_work_items",
  bulkCompleteCompatibleV10WorkItems: "bulk_complete_compatible_work_items",
} as const satisfies Record<string, V10MutationName>;

export const V10_RUNTIME_ARTIFACT_OPS_PLANS: readonly V10RuntimeArtifactOpsPlan[] = [
  {
    artifactKind: "read_models",
    owner: "engineering",
    phases: ["preflight", "dry_run", "incremental_backfill", "verify", "rollback", "post_run_report"],
    backfillMode: "source_targeted_repair",
    repairTargets: ["v10_read_model_rows", "v10_work_items", "v10_command_search_index", "v10_read_model_lineage"],
    rollbackSteps: ["archive_new_rows_by_refresh_job", "restore_previous_visible_rows", "rerun_lineage_count_check"],
    retentionDays: 90,
    diagnostics: ["refresh_job_id", "drift_state", "stale_source_tables", "missing_target_models"],
    disasterRecoveryActions: ["rebuild_from_source_tables", "regenerate_command_search_index", "verify_lineage_hashes"],
  },
  {
    artifactKind: "command_search_index",
    owner: "engineering",
    phases: ["preflight", "dry_run", "incremental_backfill", "verify", "rollback", "post_run_report"],
    backfillMode: "source_targeted_repair",
    repairTargets: ["contracts", "work_items", "accounts", "counterparties", "advanced_assurance_records"],
    rollbackSteps: ["restore_prior_rank_terms", "suppress_hidden_module_rows", "rerun_zero_result_recovery_check"],
    retentionDays: 30,
    diagnostics: ["search_index_refresh_id", "hidden_row_count", "rank_terms_safe", "zero_result_recovery_count"],
    disasterRecoveryActions: ["regenerate_from_read_models", "verify_no_core_leakage", "replay_recent_command_invalidations"],
  },
  {
    artifactKind: "audit_events",
    owner: "security",
    phases: ["preflight", "verify", "stale_evidence_invalidation", "rollback", "post_run_report"],
    backfillMode: "none",
    repairTargets: ["v10_audit_events"],
    rollbackSteps: ["append_compensating_audit_event", "preserve_original_event", "link_rollback_decision"],
    retentionDays: 2555,
    diagnostics: ["audit_event_id", "audit_action", "actor_server_derived", "metadata_hash"],
    disasterRecoveryActions: ["verify_append_only_chain", "reconcile_mutation_outcomes", "export_support_safe_audit_report"],
  },
  {
    artifactKind: "release_evidence",
    owner: "release",
    phases: ["preflight", "dry_run", "verify", "stale_evidence_invalidation", "rollback", "post_run_report"],
    backfillMode: "incremental",
    repairTargets: ["v10_release_evidence_records", "metric_runs", "non_autonomous_blockers"],
    rollbackSteps: ["mark_candidate_evidence_stale", "restore_prior_promoted_snapshot", "reactivate_blockers"],
    retentionDays: 730,
    diagnostics: ["evidence_key", "freshness_state", "blocker_status", "promotion_decision_id"],
    disasterRecoveryActions: ["rebuild_evidence_bundle", "invalidate_changed_artifacts", "archive_historical_snapshot"],
  },
  {
    artifactKind: "report_export_artifacts",
    owner: "operations",
    phases: ["preflight", "dry_run", "incremental_backfill", "verify", "rollback", "kill_switch", "post_run_report"],
    backfillMode: "incremental",
    repairTargets: ["report_runs", "contract_export_jobs", "runtime_artifacts"],
    rollbackSteps: ["revoke_new_signed_urls", "restore_previous_artifact_visibility", "record_download_audit_gap"],
    retentionDays: 30,
    diagnostics: ["artifact_key", "checksum", "expiry", "revocation_state"],
    disasterRecoveryActions: ["revoke_stale_artifacts", "regenerate_safe_artifact_index", "verify_csv_redaction"],
  },
  {
    artifactKind: "idempotency_rows",
    owner: "engineering",
    phases: ["preflight", "verify", "rollback", "post_run_report"],
    backfillMode: "none",
    repairTargets: ["v10_mutation_idempotency"],
    rollbackSteps: ["preserve_conflict_records", "expire_safe_replay_window_only", "record_replay_diagnostic"],
    retentionDays: 14,
    diagnostics: ["idempotency_key_hash", "payload_hash", "expires_at", "conflict_outcome"],
    disasterRecoveryActions: ["replay_idempotent_successes_only", "isolate_payload_conflicts", "verify_no_duplicate_work"],
  },
  {
    artifactKind: "external_links",
    owner: "security",
    phases: ["preflight", "verify", "rollback", "kill_switch", "post_run_report"],
    backfillMode: "none",
    repairTargets: ["evidence_requirements", "external_evidence_submissions"],
    rollbackSteps: ["revoke_new_links", "preserve_token_hash_audit", "notify_workspace_owner"],
    retentionDays: 30,
    diagnostics: ["token_hash", "expires_at", "revoked_at", "request_scope"],
    disasterRecoveryActions: ["revoke_stale_external_links", "reissue_scoped_links", "verify_no_workspace_browse"],
  },
] as const;

export const V10_WORKSPACE_DOWNGRADE_PLANS: readonly V10WorkspaceDowngradePlan[] = [
  {
    transition: "advanced_to_core",
    hideIneligibleRows: true,
    purgeRecentCommandLeakage: true,
    preserveAuditVisibility: true,
    suppressNotifications: true,
    readModelRepairRequired: true,
    recoveryDestination: "/settings",
  },
  {
    transition: "assurance_to_advanced",
    hideIneligibleRows: true,
    purgeRecentCommandLeakage: true,
    preserveAuditVisibility: true,
    suppressNotifications: true,
    readModelRepairRequired: true,
    recoveryDestination: "/settings",
  },
  {
    transition: "assurance_to_core",
    hideIneligibleRows: true,
    purgeRecentCommandLeakage: true,
    preserveAuditVisibility: true,
    suppressNotifications: true,
    readModelRepairRequired: true,
    recoveryDestination: "/settings",
  },
  {
    transition: "plan_past_due",
    hideIneligibleRows: true,
    purgeRecentCommandLeakage: true,
    preserveAuditVisibility: true,
    suppressNotifications: true,
    readModelRepairRequired: true,
    recoveryDestination: "/settings/billing",
  },
] as const;

export const V10_MIGRATION_SAFETY_CHECKS: readonly V10MigrationSafetyCheck[] = [
  {
    checkKey: "057_v10_runtime_contracts_forward_only",
    forwardOnly: true,
    idempotentDdl: true,
    grantsVerified: true,
    rlsVerified: true,
    indexesVerified: true,
    functionSecurityDefinerReviewed: true,
    rollbackPath: "scripts/rebuild-read-models.mjs --dry-run",
  },
  {
    checkKey: "v10_read_model_replace_rpc",
    forwardOnly: true,
    idempotentDdl: true,
    grantsVerified: true,
    rlsVerified: true,
    indexesVerified: true,
    functionSecurityDefinerReviewed: true,
    rollbackPath: "refresh_v10_runtime_artifact --artifact=read_models --mode=source_targeted_repair --dry-run-first",
  },
] as const;

export const V10_MIGRATION_ROLLOUT_SAFETY_CONTRACTS: readonly V10MigrationRolloutSafetyContract[] = [
  {
    key: "schema_additive_first_use",
    phase: "additive_migration",
    protectedArtifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/read-models.ts"],
    checks: ["forward_only", "idempotent_ddl", "rls_policy_verified", "function_security_reviewed"],
    rollbackPath: "disable_v10_runtime_paths_and_restore_previous_read_models",
    compatibilityBoundary: "new_columns_and_tables_are_additive_until_runtime_paths_are_promoted",
    cleanupCheckpoint: null,
  },
  {
    key: "runtime_read_model_backfill",
    phase: "idempotent_backfill",
    protectedArtifacts: ["v10_read_model_rows", "v10_work_items", "v10_command_search_index", "v10_read_model_lineage"],
    checks: ["dry_run", "source_targeted_repair", "lineage_count_match", "hidden_module_filter_verified"],
    rollbackPath: "archive_backfilled_rows_by_refresh_job",
    compatibilityBoundary: "source_tables_remain_authoritative_until_refresh_success_is_verified",
    cleanupCheckpoint: null,
  },
  {
    key: "release_validation_gate",
    phase: "validation_gate",
    protectedArtifacts: ["scripts/check-release-suite-current.mjs", "scripts/check-release-evidence.mjs", "semgrep/oblixa-v10-surface.yml"],
    checks: ["typecheck", "v10_suite", "release_evidence", "semgrep_error_gate"],
    rollbackPath: "mark_candidate_evidence_stale_and_pause_promotion",
    compatibilityBoundary: "stable_test_commands_remain_available",
    cleanupCheckpoint: null,
  },
  {
    key: "runtime_rollout_gate",
    phase: "rollout_gate",
    protectedArtifacts: ["src/lib/mutation-rollout.ts", "src/lib/release-contract.ts"],
    checks: ["feature_state", "kill_switch", "fixture_only", "internal_only"],
    rollbackPath: "set_rollout_state_paused_or_rolled_back",
    compatibilityBoundary: "public_urls_audit_events_and_telemetry_names_are_preserved",
    cleanupCheckpoint: null,
  },
  {
    key: "foundation_canary",
    phase: "canary",
    protectedArtifacts: ["read_models", "mutations", "audit_events", "command_search_index", "health_diagnostics"],
    checks: ["read_model_refresh_success", "mutation_replay_correctness", "audit_write_success", "route_error_budget", "command_search_integrity"],
    rollbackPath: "pause_rollout_and_rebuild_affected_runtime_artifacts",
    compatibilityBoundary: "canary_workspaces_do_not change persisted public contracts",
    cleanupCheckpoint: null,
  },
  {
    key: "foundation_rollback",
    phase: "rollback",
    protectedArtifacts: ["audit_events", "runtime_artifacts", "idempotency_rows", "release_evidence"],
    checks: ["audit_failure_threshold", "cross_org_visibility_zero", "failed_refresh_rate", "idempotency_conflict_rate", "stale_read_model_percentage"],
    rollbackPath: "execute_artifact_specific_rollback_runbook",
    compatibilityBoundary: "rollback_appends_compensating_audit_without_mutating_original_events",
    cleanupCheckpoint: null,
  },
  {
    key: "post_replacement_cleanup",
    phase: "cleanup",
    protectedArtifacts: ["compatibility_adapters", "descriptor_only_proofs", "duplicate_queue_rendering", "obsolete_fixture_descriptors"],
    checks: ["replacement_runtime_shipped", "release_evidence_promoted", "stable_command_preserved"],
    rollbackPath: "restore_adapter_from_previous_release_tag_if_public_contract_regresses",
    compatibilityBoundary: "cleanup_never_removes_public_urls_external_links_or_export_artifact_access",
    cleanupCheckpoint: "remove_after_v10_runtime_paths_are_authoritative",
  },
] as const;

export function canonicalizeV10MutationName(name: string): V10MutationName | null {
  if (V10_MUTATION_CATALOG.some((mutation) => mutation.name === name)) return name as V10MutationName;
  return V10_MUTATION_RUNTIME_ALIASES[name as keyof typeof V10_MUTATION_RUNTIME_ALIASES] ?? null;
}

function findV10MutationCatalogEntry(name: string) {
  const canonicalName = canonicalizeV10MutationName(name);
  if (canonicalName == null) return undefined;
  return V10_MUTATION_CATALOG.find((mutation) => mutation.name === canonicalName);
}

export function getV10MutationCatalogEntry(name: V10RuntimeMutationName) {
  return findV10MutationCatalogEntry(name)!;
}

function findV10MutationRolloutContract(name: string): V10MutationRolloutContract | undefined {
  const canonicalName = canonicalizeV10MutationName(name);
  if (canonicalName == null) return undefined;
  return V10_MUTATION_ROLLOUT_CONTRACTS.find((contract) => contract.mutationName === canonicalName);
}

export function getV10MutationRolloutContract(name: V10RuntimeMutationName): V10MutationRolloutContract {
  return findV10MutationRolloutContract(name)!;
}

function minimumRoleRank(minimumRole: string): number {
  const rank = getV10RoleRank(minimumRole);
  return rank === Number.NEGATIVE_INFINITY ? Number.POSITIVE_INFINITY : rank;
}

export function getV10MutationAuthorizationOutcome(input: {
  mutationName: V10RuntimeMutationName;
  actorRole: V10Role | "external_token";
  authenticated: boolean;
  sameOrganization: boolean;
  moduleHidden?: boolean;
  planAllowed?: boolean;
  modeAllowed?: boolean;
  archivedOrDeleted?: boolean;
}): V10MutationOutcome {
  if (!input.authenticated && input.actorRole !== "external_token") return "unauthorized";
  if (!input.sameOrganization) return "not_found";
  if (input.archivedOrDeleted) return "not_found";
  if (input.moduleHidden) return "hidden_module";
  if (input.planAllowed === false) return "plan_required";
  if (input.modeAllowed === false) return "mode_required";
  const catalog = findV10MutationCatalogEntry(input.mutationName);
  if (catalog == null) return "validation_failed";
  if (input.actorRole !== "external_token" && getV10RoleRank(input.actorRole) < minimumRoleRank(catalog.minimumRole)) {
    return "forbidden";
  }
  return "success";
}

export function v10MutationRequiresTransactionalAudit(name: V10RuntimeMutationName): boolean {
  return findV10MutationRolloutContract(name)?.auditRequired ?? false;
}

export function evaluateV10RolloutDecision(input: {
  rolloutState: V10RolloutState;
  actorInternal?: boolean;
  fixtureWorkspace?: boolean;
  canaryPercent?: number;
  workspaceBucket?: number;
  killSwitchActive?: boolean;
}): V10RolloutDecision {
  if (input.killSwitchActive) {
    return { allowed: false, outcome: "dependency_blocked", reason: "kill_switch_active", recoveryDestination: "/settings/health" };
  }
  if (input.rolloutState === "disabled") {
    return { allowed: false, outcome: "dependency_blocked", reason: "rollout_disabled", recoveryDestination: "/settings" };
  }
  if (input.rolloutState === "paused") {
    return { allowed: false, outcome: "dependency_blocked", reason: "rollout_paused", recoveryDestination: "/settings/health" };
  }
  if (input.rolloutState === "rolled_back") {
    return { allowed: false, outcome: "dependency_blocked", reason: "rollout_rolled_back", recoveryDestination: "/settings/health" };
  }
  if (input.rolloutState === "internal_only" && !input.actorInternal) {
    return { allowed: false, outcome: "forbidden", reason: "internal_only", recoveryDestination: "/dashboard" };
  }
  if (input.rolloutState === "fixture_only" && !input.fixtureWorkspace) {
    return { allowed: false, outcome: "dependency_blocked", reason: "fixture_only", recoveryDestination: "/settings/health" };
  }
  if (input.rolloutState === "beta_canary") {
    const bucket = input.workspaceBucket ?? 100;
    const canaryPercent = input.canaryPercent ?? 0;
    if (bucket >= canaryPercent) {
      return { allowed: false, outcome: "dependency_blocked", reason: "outside_canary", recoveryDestination: "/settings" };
    }
  }
  return { allowed: true, outcome: "success", reason: null, recoveryDestination: "current_destination" };
}

export function validateV10RollbackReadiness(input: V10RollbackReadinessInput): string[] {
  const failures: string[] = [];
  if (!input.owner?.trim()) failures.push("rollback_owner_required");
  if (!input.rollbackRunbook?.trim()) failures.push("rollback_runbook_required");
  if (!input.backfillVerified) failures.push("backfill_verification_required");
  if (!input.readModelRebuildVerified) failures.push("read_model_rebuild_required");
  if (!input.evidenceArchiveVerified) failures.push("evidence_archive_required");
  if ((input.rollbackState === "ga" || input.rollbackState === "ga_candidate") && failures.length > 0) {
    failures.push("ga_rollout_requires_complete_rollback_readiness");
  }
  return failures;
}

export function validateV10RuntimeArtifactOpsPlan(plan: V10RuntimeArtifactOpsPlan): string[] {
  const failures: string[] = [];
  if (!plan.owner.trim()) failures.push("owner_required");
  for (const phase of ["preflight", "verify", "rollback", "post_run_report"] as const) {
    if (!plan.phases.includes(phase)) failures.push(`phase_required:${phase}`);
  }
  if (plan.backfillMode !== "none" && !plan.phases.some((phase) => phase === "dry_run" || phase === "incremental_backfill")) {
    failures.push("backfill_requires_dry_run_or_incremental_phase");
  }
  if (plan.repairTargets.length === 0) failures.push("repair_target_required");
  if (plan.rollbackSteps.length === 0) failures.push("rollback_step_required");
  if (plan.retentionDays <= 0) failures.push("retention_days_required");
  if (!plan.diagnostics.some((diagnostic) => /id|key|state|hash|diagnostic/i.test(diagnostic))) {
    failures.push("support_safe_diagnostic_required");
  }
  if (plan.disasterRecoveryActions.length === 0) failures.push("disaster_recovery_action_required");
  if (plan.artifactKind === "audit_events" && plan.backfillMode !== "none") failures.push("audit_events_must_not_be_backfilled_in_place");
  if (plan.artifactKind === "external_links" && !plan.rollbackSteps.some((step) => step.includes("revoke"))) {
    failures.push("external_links_require_revocation_rollback");
  }
  return failures;
}

export function validateV10RuntimeArtifactOpsPlans(
  plans: readonly V10RuntimeArtifactOpsPlan[] = V10_RUNTIME_ARTIFACT_OPS_PLANS
): string[] {
  const failures = plans.flatMap((plan) =>
    validateV10RuntimeArtifactOpsPlan(plan).map((failure) => `${plan.artifactKind || "unknown"}:${failure}`)
  );
  for (const artifactKind of [
    "read_models",
    "command_search_index",
    "audit_events",
    "release_evidence",
    "report_export_artifacts",
    "idempotency_rows",
    "external_links",
  ] as const) {
    if (!plans.some((plan) => plan.artifactKind === artifactKind)) failures.push(`runtime_artifact_plan_missing:${artifactKind}`);
  }
  if (new Set(plans.map((plan) => plan.artifactKind)).size !== plans.length) failures.push("runtime_artifact_plan_duplicate");
  return failures;
}

export function validateV10WorkspaceDowngradePlans(
  plans: readonly V10WorkspaceDowngradePlan[] = V10_WORKSPACE_DOWNGRADE_PLANS
): string[] {
  const failures: string[] = [];
  const required = ["advanced_to_core", "assurance_to_advanced", "assurance_to_core", "plan_past_due"] as const;
  for (const plan of plans) {
    if (!plan.hideIneligibleRows) failures.push(`${plan.transition}:hide_ineligible_rows_required`);
    if (!plan.purgeRecentCommandLeakage) failures.push(`${plan.transition}:command_leakage_purge_required`);
    if (!plan.preserveAuditVisibility) failures.push(`${plan.transition}:audit_visibility_required`);
    if (!plan.suppressNotifications) failures.push(`${plan.transition}:notification_suppression_required`);
    if (!plan.readModelRepairRequired) failures.push(`${plan.transition}:read_model_repair_required`);
    if (!plan.recoveryDestination.startsWith("/settings")) failures.push(`${plan.transition}:settings_recovery_destination_required`);
  }
  for (const transition of required) {
    if (!plans.some((plan) => plan.transition === transition)) failures.push(`downgrade_plan_missing:${transition}`);
  }
  return failures;
}

export function validateV10MigrationSafetyChecks(
  checks: readonly V10MigrationSafetyCheck[] = V10_MIGRATION_SAFETY_CHECKS
): string[] {
  const failures: string[] = [];
  for (const check of checks) {
    if (!check.checkKey) failures.push("migration_check_key_required");
    if (!check.forwardOnly) failures.push(`${check.checkKey}:forward_only_required`);
    if (!check.idempotentDdl) failures.push(`${check.checkKey}:idempotent_ddl_required`);
    if (!check.grantsVerified) failures.push(`${check.checkKey}:grants_verification_required`);
    if (!check.rlsVerified) failures.push(`${check.checkKey}:rls_verification_required`);
    if (!check.indexesVerified) failures.push(`${check.checkKey}:index_verification_required`);
    if (!check.functionSecurityDefinerReviewed) failures.push(`${check.checkKey}:function_security_review_required`);
    if (!check.rollbackPath) failures.push(`${check.checkKey}:rollback_path_required`);
  }
  if (!checks.some((check) => check.checkKey === "057_v10_runtime_contracts_forward_only")) {
    failures.push("migration_check_missing:057_v10_runtime_contracts_forward_only");
  }
  return failures;
}

export function validateV10MigrationRolloutSafetyContracts(
  contracts: readonly V10MigrationRolloutSafetyContract[] = V10_MIGRATION_ROLLOUT_SAFETY_CONTRACTS
): string[] {
  const failures: string[] = [];
  const requiredPhases: readonly V10MigrationRolloutSafetyPhase[] = [
    "additive_migration",
    "idempotent_backfill",
    "validation_gate",
    "rollout_gate",
    "canary",
    "rollback",
    "cleanup",
  ];
  for (const phase of requiredPhases) {
    if (!contracts.some((contract) => contract.phase === phase)) failures.push(`migration_rollout_phase_missing:${phase}`);
  }
  for (const contract of contracts) {
    if (!contract.key) failures.push("migration_rollout_key_required");
    if (contract.protectedArtifacts.length === 0) failures.push(`${contract.key}:protected_artifact_required`);
    if (contract.checks.length === 0) failures.push(`${contract.key}:check_required`);
    if (!contract.rollbackPath) failures.push(`${contract.key}:rollback_path_required`);
    if (!contract.compatibilityBoundary) failures.push(`${contract.key}:compatibility_boundary_required`);
    if (contract.phase === "additive_migration" && !contract.checks.includes("idempotent_ddl")) {
      failures.push(`${contract.key}:idempotent_ddl_check_required`);
    }
    if (contract.phase === "idempotent_backfill" && !contract.checks.some((check) => /dry_run|idempotent/i.test(check))) {
      failures.push(`${contract.key}:dry_run_backfill_required`);
    }
    if (contract.phase === "canary" && !contract.checks.includes("read_model_refresh_success")) {
      failures.push(`${contract.key}:read_model_canary_required`);
    }
    if (contract.phase === "rollback" && !contract.checks.some((check) => /cross_org|audit|stale/i.test(check))) {
      failures.push(`${contract.key}:rollback_threshold_required`);
    }
    if (contract.phase === "cleanup" && !contract.cleanupCheckpoint) failures.push(`${contract.key}:cleanup_checkpoint_required`);
  }
  if (new Set(contracts.map((contract) => contract.key)).size !== contracts.length) failures.push("migration_rollout_duplicate");
  return failures;
}

export function buildV10BackfillRunbookManifest(input: {
  rolloutState: V10RolloutState;
  generatedAt: string;
  plans?: readonly V10RuntimeArtifactOpsPlan[];
}): V10BackfillRunbookManifest {
  const plans = input.plans ?? V10_RUNTIME_ARTIFACT_OPS_PLANS;
  const backfillPlans = plans.filter((plan) => plan.backfillMode !== "none");
  return {
    generatedAt: input.generatedAt,
    rolloutState: input.rolloutState,
    preflightCommands: [
      "npm run check:release-evidence",
      "npm run check:release-suite-current",
      "npm run typecheck",
      "node scripts/check-release-suite-current.mjs",
    ],
    backfillCommands: backfillPlans.map(
      (plan) => `refresh_v10_runtime_artifact --artifact=${plan.artifactKind} --mode=${plan.backfillMode} --dry-run-first`
    ),
    verificationCommands: [
      ...plans.map((plan) => `verify_v10_runtime_artifact --artifact=${plan.artifactKind} --diagnostics=${plan.diagnostics.join(",")}`),
      "npm run check:release-evidence",
    ],
    rollbackCommands: plans.flatMap((plan) =>
      plan.rollbackSteps.map((step) => `rollback_v10_runtime_artifact --artifact=${plan.artifactKind} --step=${step}`)
    ),
    requiredOwners: [...new Set(plans.map((plan) => plan.owner))],
    artifactKinds: plans.map((plan) => plan.artifactKind),
  };
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { buildV10BackfillRunbookManifest as buildBackfillRunbookManifest };
export { canonicalizeV10MutationName as canonicalizeMutationName };
export { evaluateV10RolloutDecision as evaluateRolloutDecision };
export { getV10MutationAuthorizationOutcome as getMutationAuthorizationOutcome };
export { getV10MutationCatalogEntry as getMutationCatalogEntry };
export { getV10MutationRolloutContract as getMutationRolloutContract };
export { V10_MIGRATION_ROLLOUT_SAFETY_CONTRACTS as MIGRATION_ROLLOUT_SAFETY_CONTRACTS };
export { V10_MIGRATION_SAFETY_CHECKS as MIGRATION_SAFETY_CHECKS };
export { V10_MUTATION_ROLLOUT_CONTRACTS as MUTATION_ROLLOUT_CONTRACTS };
export { V10_MUTATION_RUNTIME_ALIASES as MUTATION_RUNTIME_ALIASES };
export { V10_RUNTIME_ARTIFACT_OPS_PLANS as RUNTIME_ARTIFACT_OPS_PLANS };
export { V10_WORKSPACE_DOWNGRADE_PLANS as WORKSPACE_DOWNGRADE_PLANS };
export { v10MutationRequiresTransactionalAudit as mutationRequiresTransactionalAudit };
export { validateV10MigrationRolloutSafetyContracts as validateMigrationRolloutSafetyContracts };
export { validateV10MigrationSafetyChecks as validateMigrationSafetyChecks };
export { validateV10RollbackReadiness as validateRollbackReadiness };
export { validateV10RuntimeArtifactOpsPlan as validateRuntimeArtifactOpsPlan };
export { validateV10RuntimeArtifactOpsPlans as validateRuntimeArtifactOpsPlans };
export { validateV10WorkspaceDowngradePlans as validateWorkspaceDowngradePlans };
export type { V10BackfillRunbookManifest as BackfillRunbookManifest };
export type { V10MigrationRolloutSafetyContract as MigrationRolloutSafetyContract };
export type { V10MigrationRolloutSafetyPhase as MigrationRolloutSafetyPhase };
export type { V10MigrationSafetyCheck as MigrationSafetyCheck };
export type { V10MutationName as MutationName };
export type { V10MutationRolloutContract as MutationRolloutContract };
export type { V10RollbackReadinessInput as RollbackReadinessInput };
export type { V10RolloutDecision as RolloutDecision };
export type { V10RolloutOperationPhase as RolloutOperationPhase };
export type { V10RolloutState as RolloutState };
export type { V10RuntimeArtifactKind as RuntimeArtifactKind };
export type { V10RuntimeArtifactOpsPlan as RuntimeArtifactOpsPlan };
export type { V10RuntimeMutationName as RuntimeMutationName };
export type { V10WorkspaceDowngradePlan as WorkspaceDowngradePlan };
// End version-name compatibility aliases.
