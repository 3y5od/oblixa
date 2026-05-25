export type V10PlanCoverageStatus =
  | "shipped_behavior"
  | "typed_contract"
  | "release_check_required"
  | "environment_gated";

export type V10CoverageContract = {
  id: string;
  planTodoId: string;
  status: V10PlanCoverageStatus;
  sourceArtifacts: readonly string[];
  requirements: readonly string[];
};

export type V10CoveragePromotionState =
  | "runtime_backed"
  | "static_or_contract_only"
  | "release_check_required"
  | "environment_gated";

export const V10_AUTONOMOUS_COVERAGE_CONTRACTS: readonly V10CoverageContract[] = [
  {
    id: "migration-rls-runtime",
    planTodoId: "migration-rls-runtime",
    status: "shipped_behavior",
    sourceArtifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/data-contracts.test.ts"],
    requirements: ["all_v10_tables_rls_enabled", "org_scoped_member_reads", "service_role_only_writes", "idempotency_no_direct_member_access", "release_evidence_org_scope"],
  },
  {
    id: "intake-review-renewal-evidence",
    planTodoId: "intake-review-renewal-evidence",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/read-model-refresh.ts", "src/app/api/import/contracts/route.ts", "src/app/api/evidence/[id]/[action]/route.ts", "src/app/api/cron/v4/evidence-followup/route.ts"],
    requirements: ["durable_import_job_visibility", "v10_import_validation_failures", "field_provenance_rows", "renewal_checkpoint_rows", "evidence_status_rows", "external_submission_rows", "follow_up_retry_diagnostics", "notification_delivery_rows", "escalation_work_items"],
  },
  {
    id: "api-cron-job-coverage",
    planTodoId: "api-cron-job-coverage",
    status: "shipped_behavior",
    sourceArtifacts: ["src/app/api/contracts/recompute-signals/route.ts", "src/app/api/cron/v4/evidence-followup/route.ts", "src/app/api/reports/send-summaries/route.ts", "src/lib/job-visibility.ts"],
    requirements: ["read_model_refresh_trigger", "cron_audit_event", "job_retry_visibility", "report_delivery_diagnostics", "notification_delivery_state"],
  },
  {
    id: "route-surface-parity",
    planTodoId: "route-surface-parity",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/route-api-catalog.ts", "src/lib/ui-state-contracts.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    requirements: ["loading_empty_partial_failed_states", "unauthorized_forbidden_gated_states", "count_matching_destinations", "private_cache_routes"],
  },
  {
    id: "source-schema-discovery",
    planTodoId: "source-schema-discovery",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/read-model-refresh.ts", "src/lib/implementation-checklist.ts"],
    requirements: ["p0_source_tables_mapped", "p1_p2_source_tables_mapped", "gated_fallbacks_recorded", "release_check_rows_for_non_autonomous_sources"],
  },
  {
    id: "advanced-assurance-p2",
    planTodoId: "advanced-assurance-p2",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/advanced-assurance-continuity.ts", "src/lib/read-model-refresh.ts", "src/lib/continuity.test.ts"],
    requirements: ["advanced_records_link_work_search_audit", "assurance_records_hidden_from_core", "notification_delivery_or_suppression_policy", "p2_automation_approval_gate", "automation_run_linked_record", "revert_warning_contract"],
  },
  {
    id: "privacy-a11y-performance",
    planTodoId: "privacy-a11y-performance",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/hardening-contracts.ts", "src/lib/ui-state-contracts.ts", "src/lib/route-api-catalog.ts"],
    requirements: ["privacy_safe_copy", "keyboard_focus_recovery", "responsive_route_states", "payload_and_pagination_budgets", "csv_formula_neutralization"],
  },
  {
    id: "fixture-seed-and-metrics",
    planTodoId: "fixture-seed-and-metrics",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/release-evidence.ts", "src/lib/readiness-scorecard.ts"],
    requirements: ["fixed_denominators", "exclusion_accounting", "metric_requirement_catalog", "synthetic_descriptor_only_until_rc"],
  },
  {
    id: "security-negative-tests",
    planTodoId: "security-negative-tests",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/hardening-contracts.ts", "src/lib/server-contracts.test.ts", "src/lib/data-contracts.test.ts"],
    requirements: ["cross_org_denial", "hidden_module_denial", "unsafe_metadata_redaction", "client_actor_rejected", "external_token_scope"],
  },
  {
    id: "observability-slo-artifacts",
    planTodoId: "observability-slo-artifacts",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/objective-telemetry.ts", "src/lib/hardening-contracts.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    requirements: ["slo_keys", "dashboard_freshness", "support_safe_diagnostic_ids", "alert_retry_paths", "post_ga_promotion_records"],
  },
  {
    id: "requirement-ledger",
    planTodoId: "requirement-ledger",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/traceability-ledger.ts", "src/lib/spec-trace-map.ts", "src/lib/implementation-checklist.ts"],
    requirements: ["section_to_artifact_mapping", "automated_proof", "release_check_proof", "non_autonomous_blockers"],
  },
  {
    id: "api-action-inventory",
    planTodoId: "api-action-inventory",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/route-api-catalog.ts", "src/actions/tasks.ts", "src/actions/approvals.ts", "src/actions/exceptions.ts", "src/actions/product-surface-settings.ts"],
    requirements: ["auth_scope", "org_scope", "eligibility_scope", "audit_scope", "telemetry_scope", "recovery_scope", "server_action_mutation_envelopes"],
  },
  {
    id: "action-compatibility-model",
    planTodoId: "action-compatibility-model",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/work-semantics.ts", "src/lib/read-model-refresh.ts"],
    requirements: ["compatible_action_group", "bulk_item_outcomes", "stale_owner_handling", "blocker_resolution", "deterministic_action_availability"],
  },
  {
    id: "data-freshness-contracts",
    planTodoId: "data-freshness-contracts",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/read-model-refresh.ts", "src/app/api/contracts/recompute-signals/route.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    requirements: ["freshness_timestamp", "refresh_trigger", "partial_refresh_diagnostic", "user_visible_recovery", "count_reconciliation"],
  },
  {
    id: "query-index-budgets",
    planTodoId: "query-index-budgets",
    status: "shipped_behavior",
    sourceArtifacts: ["supabase/migrations/057_v10_runtime_contracts.sql", "src/lib/route-api-catalog.ts"],
    requirements: ["query_shape_budget", "indexes_for_lenses", "payload_budget", "pagination_limit", "async_handoff_threshold", "command_search_debounce"],
  },
  {
    id: "edge-case-semantics",
    planTodoId: "edge-case-semantics",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/operational-contracts.ts", "src/lib/work-semantics.ts", "src/lib/renewal-posture.ts"],
    requirements: ["timezone_boundaries", "date_only_vs_timestamp", "currency_thresholds", "duplicate_detection", "large_result_sets", "partial_job_states"],
  },
  {
    id: "lifecycle-retention",
    planTodoId: "lifecycle-retention",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/hardening-contracts.ts", "src/lib/release-evidence.ts"],
    requirements: ["archive_delete_restore_visibility", "external_link_expiry_revocation", "artifact_retention", "audit_retention", "diagnostic_retention"],
  },
  {
    id: "shared-primitives",
    planTodoId: "shared-primitives",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/status-action-vocabulary.ts", "src/lib/ui-state-contracts.ts", "src/components/layout/command-palette.tsx"],
    requirements: ["status_badges", "empty_states", "queue_cards", "permission_hints", "audit_summaries", "recovery_copy", "command_palette_recovery_action_labels"],
  },
  {
    id: "data-classification",
    planTodoId: "data-classification",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/server-contracts.ts", "src/lib/hardening-contracts.ts", "src/lib/release-evidence.ts"],
    requirements: ["client_safe", "server_safe", "audit_safe", "telemetry_safe", "export_safe", "diagnostic_safe", "prohibited"],
  },
  {
    id: "notification-communication-policy",
    planTodoId: "notification-communication-policy",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/hardening-contracts.ts", "src/lib/objective-telemetry.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    requirements: ["eligibility", "preferences", "unsubscribe", "suppressed_module", "reminder_blocker", "external_link", "failure_retry_audit"],
  },
  {
    id: "deterministic-oracles",
    planTodoId: "deterministic-oracles",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/work-semantics.ts", "src/lib/contract-health.ts", "src/lib/renewal-posture.ts", "src/lib/release-evidence.ts", "src/app/api/command-palette/contracts/route.ts"],
    requirements: ["sorting", "health_deductions", "next_actions", "due_states", "renewal_posture", "eligibility_outcomes", "mutation_responses", "plan_minimum_search_filter"],
  },
  {
    id: "end-to-end-journeys",
    planTodoId: "end-to-end-journeys",
    status: "shipped_behavior",
    sourceArtifacts: ["e2e/current-product-core-smoke.spec.ts", "src/lib/implementation-checklist.ts"],
    requirements: ["first_activation", "daily_work_clearance", "contract_trust_review", "renewal_prevention", "evidence_collaboration", "report_export_recovery", "governance_changes"],
  },
  {
    id: "failure-mode-taxonomy",
    planTodoId: "failure-mode-taxonomy",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/operational-contracts.ts", "src/lib/mutation-envelope.ts"],
    requirements: ["validation", "auth", "eligibility", "hidden_modules", "conflicts", "stale_versions", "dependency_blockers", "provider_failures", "audit_failures"],
  },
  {
    id: "provider-ai-boundaries",
    planTodoId: "provider-ai-boundaries",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/operational-contracts.ts", "src/lib/hardening-contracts.ts"],
    requirements: ["supabase_rls", "resend_retry_privacy", "openai_prompt_injection_boundary", "stripe_plan_state", "vercel_cron_runtime", "playwright_env_gate", "external_upload_scope"],
  },
  {
    id: "implementation-slicing",
    planTodoId: "implementation-slicing",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/autonomous-coverage.ts", "src/lib/traceability-ledger.ts"],
    requirements: ["reviewable_batches", "prerequisites", "expected_proofs", "rollback_considerations", "checkpoint_reviews"],
  },
  {
    id: "final-reporting",
    planTodoId: "final-reporting",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/autonomous-coverage.ts", "src/lib/release-evidence.ts"],
    requirements: ["completed_behavior", "evidence_commands", "blocked_rows", "environment_gated_tests", "residual_risks", "next_release_checks"],
  },
  {
    id: "docs-and-removals",
    planTodoId: "docs-and-removals",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/release-contract.ts", "scripts/check-release-evidence.mjs"],
    requirements: ["docs_non_authoritative", "no_new_top_level_family", "v9_release_wiring_superseded", "non_goals_enforced"],
  },
  {
    id: "rollout-backfill-recovery",
    planTodoId: "rollout-backfill-recovery",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/mutation-rollout.ts", "src/lib/read-model-refresh.ts", "src/app/(dashboard)/settings/health/page.tsx"],
    requirements: ["backfill", "retry", "downgrade", "hidden_module_transition", "stale_read_model_recovery", "orphan_prevention"],
  },
  {
    id: "regression-boundaries",
    planTodoId: "regression-boundaries",
    status: "shipped_behavior",
    sourceArtifacts: ["scripts/pipelines/pipeline-surface-suite.mjs", "scripts/check-release-suite-current.mjs"],
    requirements: ["v8_v9_gates_preserved", "core_paths_preserved", "hidden_feature_boundaries", "route_contracts_preserved"],
  },
  {
    id: "ci-ratchets",
    planTodoId: "ci-ratchets",
    status: "shipped_behavior",
    sourceArtifacts: ["scripts/check-release-evidence.mjs", "scripts/check-release-suite-current.mjs", "package.json"],
    requirements: ["spec_drift_failure", "missing_evidence_failure", "untracked_route_failure", "unsafe_telemetry_failure", "missing_rls_failure", "fixture_staleness_failure"],
  },
  {
    id: "release-promotion-rollback",
    planTodoId: "release-promotion-rollback",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/readiness-scorecard.ts", "src/lib/release-evidence.ts", "src/lib/hardening-contracts.ts"],
    requirements: ["beta_to_ga_promotion", "evidence_invalidation", "rollback", "kill_switch", "incident_review", "post_release_review"],
  },
  {
    id: "domain-workflows",
    planTodoId: "domain-workflows",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/read-model-refresh.ts",
      "src/lib/final-gap-audit.ts",
      "src/lib/domain-depth-contracts.ts",
      "src/app/api/approvals/[id]/[action]/route.ts",
      "src/app/api/exceptions/[id]/[action]/route.ts",
      "src/app/api/renewals/[id]/[action]/route.ts",
    ],
    requirements: [
      "activation_review_renewal_evidence",
      "approval_exception_state_changes",
      "report_export_job_visibility",
      "notification_recovery",
      "advanced_assurance_continuity",
    ],
  },
  {
    id: "security-privacy",
    planTodoId: "security-privacy",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/hardening-contracts.ts",
      "src/lib/server-contracts.ts",
      "src/lib/data-contracts.test.ts",
      "supabase/migrations/057_v10_runtime_contracts.sql",
    ],
    requirements: [
      "tenant_isolation",
      "denial_non_leakage",
      "metadata_redaction",
      "external_link_scope",
      "audit_immutability",
    ],
  },
  {
    id: "release-evidence-boundaries",
    planTodoId: "release-evidence-boundaries",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/release-evidence.ts",
      "src/lib/readiness-scorecard.ts",
      "scripts/check-release-evidence.mjs",
    ],
    requirements: [
      "human_provider_dashboard_canary_blockers",
      "waiver_rules",
      "rollback_readiness",
      "support_readiness",
      "post_ga_observation",
    ],
  },
  {
    id: "fixtures-backfill",
    planTodoId: "fixtures-backfill",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/release-evidence.ts",
      "src/lib/objective-measurements.ts",
      "src/lib/read-model-refresh.ts",
      "scripts/check-release-evidence.mjs",
    ],
    requirements: [
      "fixture_manifest",
      "fixed_denominator",
      "dry_run_repair",
      "privacy_scan",
      "generated_data_cleanup",
    ],
  },
  {
    id: "observability-ops",
    planTodoId: "observability-ops",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/operational-contracts.ts",
      "src/lib/objective-telemetry.ts",
      "src/app/(dashboard)/settings/health/page.tsx",
      "src/lib/job-visibility.ts",
    ],
    requirements: [
      "support_safe_diagnostics",
      "settings_health_recovery",
      "slo_measurement_hooks",
      "operator_runbooks",
      "failure_injection_contracts",
    ],
  },
  {
    id: "rollout-rollback",
    planTodoId: "rollout-rollback",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/mutation-rollout.ts",
      "src/lib/operational-contracts.ts",
      "src/lib/release-evidence.ts",
      "src/lib/hardening-contracts.ts",
    ],
    requirements: [
      "progressive_release_states",
      "feature_lifecycle",
      "rollback_criteria",
      "canary_blast_radius",
      "evidence_invalidation",
    ],
  },
  {
    id: "entitlements-integrations",
    planTodoId: "entitlements-integrations",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/domain-depth-contracts.ts",
      "src/lib/operational-contracts.ts",
      "src/lib/hardening-contracts.ts",
      "src/lib/governance.ts",
    ],
    requirements: [
      "plan_billing_state",
      "provider_configuration",
      "notification_policy",
      "storage_email_ai_cron_boundaries",
      "external_integration_privacy",
    ],
  },
  {
    id: "browser-performance",
    planTodoId: "browser-performance",
    status: "shipped_behavior",
    sourceArtifacts: [
      "e2e/current-product-core-smoke.spec.ts",
      "src/lib/domain-depth-contracts.ts",
      "src/lib/hardening-contracts.ts",
      "src/components/ui/recoverable-state.tsx",
    ],
    requirements: [
      "browser_matrix",
      "responsive_breakpoints",
      "keyboard_a11y",
      "large_workspace_budgets",
      "pagination_virtualization",
    ],
  },
  {
    id: "ship-stop-criteria",
    planTodoId: "ship-stop-criteria",
    status: "shipped_behavior",
    sourceArtifacts: ["src/lib/readiness-scorecard.ts", "src/lib/release-evidence.ts"],
    requirements: ["beta_criteria", "ga_criteria", "complete_criteria", "local_implementation", "environment_gated", "blocked_with_reason"],
  },
  {
    id: "exhaustive-artifact-sweep",
    planTodoId: "exhaustive-artifact-sweep",
    status: "shipped_behavior",
    sourceArtifacts: [
      "scripts/check-release-evidence.mjs",
      "src/lib/final-gap-audit.ts",
      "src/lib/autonomous-coverage.ts",
      "src/lib/traceability-ledger.ts",
    ],
    requirements: [
      "file_level_closure",
      "route_action_inventory",
      "migration_script_test_ui_surface_fixture_runbook_evidence",
      "no_silent_exclusions",
      "final_verification_commands",
    ],
  },
  {
    id: "non-autonomous-proof",
    planTodoId: "non-autonomous-proof",
    status: "shipped_behavior",
    sourceArtifacts: [
      "src/lib/release-evidence.ts",
      "src/lib/readiness-scorecard.ts",
      "scripts/check-release-evidence.mjs",
    ],
    requirements: [
      "human_evidence",
      "provider_configuration",
      "dashboard_canary",
      "release_owner_signoff",
      "support_post_ga_evidence",
      "blocker_or_promoted_evidence",
    ],
  },
] as const;

export const V10_REQUIRED_PLAN_TODO_IDS = V10_AUTONOMOUS_COVERAGE_CONTRACTS.map((contract) => contract.planTodoId);

export function getV10CoverageContract(planTodoId: string): V10CoverageContract | null {
  return V10_AUTONOMOUS_COVERAGE_CONTRACTS.find((contract) => contract.planTodoId === planTodoId) ?? null;
}

export function v10CoverageHasRequirement(planTodoId: string, requirement: string): boolean {
  return getV10CoverageContract(planTodoId)?.requirements.includes(requirement) ?? false;
}

export function summarizeV10CoverageByStatus(): Record<V10PlanCoverageStatus, number> {
  const summary: Record<V10PlanCoverageStatus, number> = {
    shipped_behavior: 0,
    typed_contract: 0,
    release_check_required: 0,
    environment_gated: 0,
  };
  for (const contract of V10_AUTONOMOUS_COVERAGE_CONTRACTS) summary[contract.status] += 1;
  return summary;
}

export function classifyV10CoveragePromotionState(contract: V10CoverageContract): V10CoveragePromotionState {
  if (contract.status === "release_check_required") return "release_check_required";
  if (contract.status === "environment_gated") return "environment_gated";
  if (contract.status === "typed_contract") return "static_or_contract_only";
  if (contract.status === "shipped_behavior") return "runtime_backed";
  return "static_or_contract_only";
}

export function validateV10AutonomousCoveragePromotion(
  contracts: readonly V10CoverageContract[] = V10_AUTONOMOUS_COVERAGE_CONTRACTS
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const contract of contracts) {
    if (seen.has(contract.id)) failures.push(`duplicate:${contract.id}`);
    seen.add(contract.id);
    if (contract.sourceArtifacts.length === 0) failures.push(`missing_artifact:${contract.id}`);
    if (contract.requirements.length === 0) failures.push(`missing_requirement:${contract.id}`);
    if (contract.status === "shipped_behavior" && classifyV10CoveragePromotionState(contract) !== "runtime_backed") {
      failures.push(`shipped_coverage_without_runtime:${contract.id}`);
    }
  }
  return failures;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { classifyV10CoveragePromotionState as classifyCoveragePromotionState };
export { getV10CoverageContract as getCoverageContract };
export { summarizeV10CoverageByStatus as summarizeCoverageByStatus };
export { V10_AUTONOMOUS_COVERAGE_CONTRACTS as AUTONOMOUS_COVERAGE_CONTRACTS };
export { V10_REQUIRED_PLAN_TODO_IDS as REQUIRED_PLAN_TODO_IDS };
export { v10CoverageHasRequirement as coverageHasRequirement };
export { validateV10AutonomousCoveragePromotion as validateAutonomousCoveragePromotion };
export type { V10CoverageContract as CoverageContract };
export type { V10CoveragePromotionState as CoveragePromotionState };
export type { V10PlanCoverageStatus as PlanCoverageStatus };
// End version-name compatibility aliases.
