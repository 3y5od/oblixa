export const V10_SPEC_VERSION = "v10.0.0" as const;

export type V10VersionedArtifactKind =
  | "schema"
  | "read_model"
  | "api"
  | "mutation"
  | "telemetry"
  | "release_evidence"
  | "fixture"
  | "acceptance_matrix";

export type V10CompatibilityPolicy = "additive_only" | "breaking_requires_major" | "evidence_version_locked";

export type V10VersionedArtifactContract = {
  kind: V10VersionedArtifactKind;
  version: string;
  compatibilityPolicy: V10CompatibilityPolicy;
  traceabilityRequired: boolean;
  migrationOrEvidenceRequired: boolean;
};

export const V10_VERSIONED_ARTIFACT_CONTRACTS: readonly V10VersionedArtifactContract[] = [
  { kind: "schema", version: V10_SPEC_VERSION, compatibilityPolicy: "breaking_requires_major", traceabilityRequired: true, migrationOrEvidenceRequired: true },
  { kind: "read_model", version: V10_SPEC_VERSION, compatibilityPolicy: "additive_only", traceabilityRequired: true, migrationOrEvidenceRequired: true },
  { kind: "api", version: V10_SPEC_VERSION, compatibilityPolicy: "additive_only", traceabilityRequired: true, migrationOrEvidenceRequired: false },
  { kind: "mutation", version: V10_SPEC_VERSION, compatibilityPolicy: "additive_only", traceabilityRequired: true, migrationOrEvidenceRequired: false },
  { kind: "telemetry", version: V10_SPEC_VERSION, compatibilityPolicy: "additive_only", traceabilityRequired: true, migrationOrEvidenceRequired: true },
  { kind: "release_evidence", version: V10_SPEC_VERSION, compatibilityPolicy: "evidence_version_locked", traceabilityRequired: true, migrationOrEvidenceRequired: true },
  { kind: "fixture", version: V10_SPEC_VERSION, compatibilityPolicy: "evidence_version_locked", traceabilityRequired: true, migrationOrEvidenceRequired: true },
  { kind: "acceptance_matrix", version: V10_SPEC_VERSION, compatibilityPolicy: "additive_only", traceabilityRequired: true, migrationOrEvidenceRequired: false },
] as const;

export const V10_NAVIGATION_FAMILIES = [
  "Home",
  "Contracts",
  "Review",
  "Work",
  "Renewals",
  "Exceptions",
  "Evidence",
  "Reports",
  "Settings",
  "Advanced",
  "Assurance",
] as const;

export function validateV10VersionedArtifactContract(contract: V10VersionedArtifactContract): string[] {
  const failures: string[] = [];
  if (!/^v10\.\d+\.\d+$/.test(contract.version)) failures.push("version_must_be_v10_semver");
  if (!contract.traceabilityRequired) failures.push("traceability_required");
  if (
    (contract.kind === "schema" || contract.kind === "release_evidence" || contract.kind === "fixture") &&
    !contract.migrationOrEvidenceRequired
  ) {
    failures.push("migration_or_evidence_required");
  }
  if (contract.kind === "schema" && contract.compatibilityPolicy !== "breaking_requires_major") {
    failures.push("schema_breaking_policy_required");
  }
  if (
    (contract.kind === "release_evidence" || contract.kind === "fixture") &&
    contract.compatibilityPolicy !== "evidence_version_locked"
  ) {
    failures.push("evidence_version_lock_required");
  }
  return failures;
}

export function getV10VersionedArtifactContract(kind: V10VersionedArtifactKind): V10VersionedArtifactContract {
  return V10_VERSIONED_ARTIFACT_CONTRACTS.find((contract) => contract.kind === kind)!;
}

export const V10_RELEASE_CONTRACT_BEHAVIORS = [
  "intake",
  "review",
  "ownership",
  "approvals",
  "renewals",
  "obligations",
  "exceptions",
  "evidence",
  "reporting",
  "search",
  "settings",
  "job recovery",
] as const;

export const V10_WORK_ITEM_TYPES = [
  "field_review",
  "contract_task",
  "obligation",
  "approval",
  "renewal_checkpoint",
  "exception",
  "evidence_request",
  "report_failure",
  "export_failure",
  "import_failure",
  "extraction_failure",
  "automation_approval",
  "unassigned_work",
] as const;

export const V10_WORK_ITEM_STATUSES = [
  "open",
  "in_progress",
  "blocked",
  "waiting",
  "done",
  "canceled",
] as const;

export const V10_DUE_STATES = ["none", "due_today", "due_soon", "overdue"] as const;
export const V10_OWNER_STATES = ["assigned", "unassigned", "stale"] as const;
export const V10_PRIORITIES = ["none", "low", "normal", "high", "urgent"] as const;
export const V10_SEVERITIES = ["none", "low", "medium", "high", "critical"] as const;

export const V10_FIELD_STATES = [
  "extracted",
  "approved",
  "rejected",
  "missing",
  "ambiguous",
  "user_supplied",
  "stale_source",
] as const;

export const V10_CONFIDENCE_STATES = ["none", "low", "medium", "high"] as const;

export const V10_RENEWAL_POSTURES = [
  "no_approved_renewal_data",
  "blocked_missing_approved_dates",
  "no_renewal_action_required",
  "monitor",
  "plan",
  "negotiate",
  "notice_deadline_approaching",
  "notice_overdue",
  "renewal_overdue",
  "completed",
] as const;

export const V10_JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed_retryable",
  "failed_terminal",
  "retrying",
  "canceled",
] as const;

export const V10_CANCELLATION_STATES = [
  "cancelable",
  "not_cancelable",
  "cancel_requested",
  "canceled",
] as const;

export const V10_MUTATION_OUTCOMES = [
  "success",
  "validation_failed",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "stale_version",
  "plan_required",
  "mode_required",
  "hidden_module",
  "rate_limited",
  "dependency_blocked",
  "job_not_retryable",
  "external_link_expired",
  "external_link_revoked",
  "audit_write_failed",
  "no_action",
  "server_error",
] as const;

export const V10_WORKSPACE_MODES = ["core", "advanced", "assurance"] as const;

export const V10_ROLES = [
  "viewer",
  "legal_reviewer",
  "finance_reviewer",
  "editor",
  "ops_manager",
  "manager",
  "admin",
] as const;

export const V10_PLANS = ["trial", "core", "advanced", "assurance", "enterprise"] as const;

export const V10_ROLE_ORDER = V10_ROLES;
export const V10_WORKSPACE_MODE_ORDER = V10_WORKSPACE_MODES;
export const V10_PLAN_ORDER = V10_PLANS;

export function getV10RoleRank(role: string | null | undefined): number {
  if (role === "external_token") return 0;
  const index = V10_ROLE_ORDER.indexOf(role as V10Role);
  return index === -1 ? Number.NEGATIVE_INFINITY : index + 1;
}

export function getV10WorkspaceModeRank(mode: string | null | undefined): number {
  const index = V10_WORKSPACE_MODE_ORDER.indexOf(mode as V10WorkspaceMode);
  return index === -1 ? Number.NEGATIVE_INFINITY : index + 1;
}

export function getV10PlanRank(plan: string | null | undefined): number {
  const index = V10_PLAN_ORDER.indexOf(plan as V10Plan);
  return index === -1 ? Number.NEGATIVE_INFINITY : index + 1;
}

export const V10_VISIBILITY_STATES = [
  "visible",
  "hidden_by_mode",
  "hidden_by_role",
  "hidden_by_plan",
  "hidden_by_module",
  "deleted",
  "archived",
] as const;

export const V10_SOURCE_OBJECT_TYPES = [
  "contract",
  "work_item",
  "field",
  "obligation",
  "approval",
  "exception",
  "evidence_request",
  "external_evidence_submission",
  "report_run",
  "export_job",
  "import_job",
  "extraction_job",
  "file_upload",
  "automation_run",
  "audit_event",
  "notification_delivery",
  "reminder",
  "renewal_checkpoint",
  "finding",
  "control",
  "campaign",
  "decision",
  "simulation",
  "program",
  "scorecard",
  "playbook",
  "review_board",
  "health_graph",
  "account",
  "counterparty",
  "relationship",
  "saved_view",
  "setting",
  "setting_destination",
  "workspace_health_diagnostic",
  "billing_sync",
  "runtime_artifact",
] as const;

export const V10_CORE_REPORT_FAMILIES = [
  "contract_portfolio_summary",
  "renewal_horizon_report",
  "overdue_work_report",
  "exception_report",
  "evidence_status_report",
  "approval_sla_report",
  "data_quality_report",
  "audit_activity_report",
  "import_extraction_reliability_report",
  "workspace_health_report",
] as const;

export const V10_JOB_CLASSES = [
  "contract_import",
  "file_upload",
  "extraction",
  "export",
  "report_generation",
  "report_delivery",
  "reminder_generation",
  "notification_delivery",
  "automation_execution",
  "billing_sync",
] as const;

export const V10_NOTIFICATION_CLASSES = [
  "due_work",
  "overdue_work",
  "pending_approval",
  "renewal_horizon",
  "notice_deadline",
  "evidence_request",
  "evidence_rejected",
  "exception_assignment",
  "review_backlog",
  "failed_import",
  "failed_extraction",
  "failed_report",
  "failed_export",
  "automation_approval_required",
] as const;

export const V10_ACTIVATION_STATES = [
  "workspace_prepared",
  "contract_uploaded_or_imported",
  "extraction_queued",
  "extraction_running",
  "extraction_partially_complete",
  "extraction_failed",
  "required_field_review_ready",
  "required_fields_approved",
  "owner_assigned",
  "first_work_item_generated",
  "dashboard_updated",
] as const;

export const V10_REQUIRED_ACTIVATION_FIELDS = [
  "title",
  "counterparty",
  "contract_type",
  "lifecycle_status",
  "owner_or_unassigned_state",
  "effective_date",
  "end_date",
  "renewal_date",
  "notice_deadline",
  "governing_law",
  "contract_value_and_currency",
] as const;

export const V10_REQUIRED_DATE_CLASSES = [
  "effective_date",
  "end_date",
  "renewal_date",
  "notice_deadline",
  "auto_renewal_date",
  "termination_deadline",
  "obligation_due_date",
  "approval_due_date",
  "evidence_due_date",
] as const;

export const V10_RENEWAL_HORIZONS = [
  "365_days",
  "180_days",
  "90_days",
  "60_days",
  "30_days",
  "14_days",
  "7_days",
  "1_day",
  "overdue",
] as const;

export const V10_WORK_LENSES = [
  "assigned_to_me",
  "assigned_to_my_team",
  "unassigned",
  "due_today",
  "due_soon",
  "overdue",
  "blocked",
  "high_risk",
  "recently_completed",
  "failed_jobs",
  "automation_approvals",
] as const;

export const V10_WORK_ACTIONS = [
  "open_source_object",
  "assign_owner",
  "mark_done",
  "approve_approval",
  "reject_approval",
  "request_evidence",
  "accept_evidence",
  "reject_evidence",
  "resolve_exception",
  "retry_failed_job",
  "dismiss_resolved_system_alert",
  "bulk_assign_compatible_items",
  "bulk_mark_compatible_items_done",
] as const;

export const V10_HEALTH_DEDUCTIONS = [
  { key: "missing_required_activation_field", points: 20 },
  { key: "missing_or_unapproved_critical_date", points: 15 },
  { key: "overdue_linked_work", points: 15 },
  { key: "open_high_or_critical_exception", points: 15 },
  { key: "outstanding_evidence_not_overdue", points: 10 },
  { key: "renewal_notice_deadline_inside_30_days", points: 10 },
  { key: "missing_or_stale_owner", points: 10 },
  { key: "failed_or_partial_retryable_job", points: 10 },
  { key: "missing_recommended_fields", points: 5 },
] as const;

export const V10_HEALTH_BANDS = [
  { band: "healthy", min: 85, max: 100 },
  { band: "watch", min: 70, max: 84 },
  { band: "at_risk", min: 60, max: 69 },
  { band: "critical", min: 0, max: 59 },
] as const;

export const V10_CONTRACT_NEXT_ACTION_ORDER = [
  "failed_import_or_extraction_blocking_record_creation",
  "missing_required_activation_field",
  "pending_required_field_review",
  "overdue_approval",
  "overdue_obligation",
  "overdue_evidence_request",
  "open_critical_exception",
  "renewal_notice_deadline_inside_30_days",
  "renewal_date_inside_90_days",
  "unassigned_owner",
  "missing_recommended_field",
  "no_action_required",
] as const;

export const V10_SHARED_READ_MODEL_FIELDS = [
  "id",
  "organization_id",
  "workspace_mode",
  "required_role_minimum",
  "feature_family",
  "source_table",
  "source_id",
  "created_at",
  "updated_at",
  "deleted_at",
  "archived_at",
  "visibility_state",
] as const;

export const V10_READ_MODEL_FIELDS = {
  activation_state: [
    "user_id",
    "contract_id",
    "state",
    "accepted_upload_at",
    "extraction_started_at",
    "extraction_completed_at",
    "required_fields_total",
    "required_fields_approved",
    "owner_state",
    "first_generated_work_item_id",
    "first_generated_work_item_at",
    "blocked_reason",
    "next_action",
  ],
  work_items: [
    "type",
    "status",
    "title",
    "contract_id",
    "source_type",
    "source_id",
    "owner_user_id",
    "owner_state",
    "due_at",
    "due_state",
    "priority",
    "severity",
    "blocked_reason",
    "primary_action",
    "secondary_actions",
    "compatible_action_group",
    "last_state_change_at",
    "last_state_change_actor_id",
    "audit_event_id",
  ],
  contract_health_snapshots: [
    "contract_id",
    "score",
    "band",
    "deductions",
    "next_action",
    "computed_at",
    "stale_owner",
    "missing_required_field_count",
    "missing_critical_date_count",
    "overdue_work_count",
    "open_high_or_critical_exception_count",
    "outstanding_evidence_count",
    "failed_or_partial_job_count",
  ],
  contract_activity_events: [
    "contract_id",
    "actor_user_id",
    "actor_display",
    "action",
    "target_type",
    "target_id",
    "outcome",
    "safe_summary",
    "metadata_safe",
    "occurred_at",
  ],
  field_provenance_records: [
    "contract_id",
    "field_key",
    "current_value_display",
    "value_hash",
    "state",
    "source_label",
    "source_file_id",
    "confidence_state",
    "reviewer_user_id",
    "reviewed_at",
    "rejection_reason",
    "last_modified_actor_id",
    "last_modified_at",
  ],
  renewal_posture_snapshots: [
    "contract_id",
    "posture",
    "horizon",
    "approved_end_date",
    "approved_renewal_date",
    "approved_notice_deadline",
    "reminder_eligible",
    "blocked_reason",
    "next_checkpoint_work_item_id",
    "computed_at",
  ],
  evidence_request_statuses: [
    "evidence_request_id",
    "contract_id",
    "requester_user_id",
    "external_responder_state",
    "due_at",
    "status",
    "submission_count",
    "latest_submission_at",
    "reviewer_user_id",
    "reviewed_at",
    "rejection_reason",
    "resubmission_allowed",
    "external_link_state",
    "audit_event_ids",
  ],
  obligation_records: [
    "obligation_id",
    "contract_id",
    "title",
    "owner_user_id",
    "owner_state",
    "status",
    "due_at",
    "due_state",
    "source_field_key",
    "source_clause_hash",
    "evidence_required",
    "evidence_request_ids",
    "linked_exception_ids",
    "last_activity_at",
    "audit_event_ids",
  ],
  approval_records: [
    "approval_id",
    "contract_id",
    "approval_type",
    "requester_user_id",
    "approver_user_id",
    "delegated_approver_user_id",
    "status",
    "due_at",
    "due_state",
    "sla_state",
    "decision_note_state",
    "decided_at",
    "linked_decision_id",
    "audit_event_ids",
  ],
  exception_records: [
    "exception_id",
    "contract_id",
    "title",
    "severity",
    "owner_user_id",
    "owner_state",
    "status",
    "root_cause",
    "due_at",
    "due_state",
    "source_type",
    "linked_source_id",
    "resolution_action",
    "resolved_at",
    "reopened_at",
    "linked_task_ids",
    "linked_evidence_request_ids",
    "linked_approval_id",
    "linked_decision_id",
    "audit_event_ids",
  ],
  notification_deliveries: [
    "notification_id",
    "notification_class",
    "recipient_user_id",
    "recipient_channel",
    "source_type",
    "linked_source_id",
    "contract_id",
    "eligibility_state",
    "preference_state",
    "scheduled_at",
    "sent_at",
    "delivery_status",
    "failure_category",
    "diagnostic_id",
    "deep_link_href",
    "audit_event_id",
  ],
  renewal_checkpoint_records: [
    "renewal_checkpoint_id",
    "contract_id",
    "checkpoint_type",
    "owner_user_id",
    "owner_state",
    "status",
    "due_at",
    "due_state",
    "approved_notice_deadline",
    "approved_renewal_date",
    "posture_before",
    "posture_after",
    "reminder_eligible",
    "blocked_reason",
    "audit_event_ids",
  ],
  external_evidence_submissions: [
    "submission_id",
    "evidence_request_id",
    "contract_id",
    "external_link_id",
    "submitter_name_state",
    "submitter_email_state",
    "submitted_at",
    "file_count",
    "file_type_summary",
    "note_state",
    "upload_status",
    "review_status",
    "reviewer_user_id",
    "reviewed_at",
    "rejection_reason",
    "audit_event_ids",
  ],
  audit_events: [
    "audit_event_id",
    "organization_id",
    "actor_user_id",
    "actor_type",
    "action",
    "target_type",
    "target_id",
    "contract_id",
    "outcome",
    "before_state_hash",
    "after_state_hash",
    "safe_metadata",
    "created_at",
    "diagnostic_id",
  ],
  job_run_visibility: [
    "job_id",
    "job_class",
    "status",
    "cancellation_state",
    "source_type",
    "source_id",
    "contract_id",
    "started_at",
    "completed_at",
    "completed_count",
    "failed_count",
    "skipped_count",
    "retryable_count",
    "diagnostic_id",
    "failure_category",
    "user_visible_detail",
    "retry_action",
  ],
  report_run_visibility: [
    "report_run_id",
    "report_family",
    "source_filters_safe",
    "initiated_by_user_id",
    "schedule_id",
    "status",
    "started_at",
    "completed_at",
    "selected_row_count",
    "generated_row_count",
    "artifact_url",
    "delivery_destination_state",
    "failure_category",
    "diagnostic_id",
    "retry_action",
  ],
  command_search_index: [
    "record_type",
    "record_id",
    "label",
    "description_safe",
    "href",
    "rank_terms_safe",
    "workspace_mode_minimum",
    "required_role_minimum",
    "feature_family",
    "module_key",
    "plan_minimum",
    "updated_at",
  ],
  advanced_assurance_linked_records: [
    "record_type",
    "record_id",
    "workspace_mode_minimum",
    "status",
    "owner_user_id",
    "source_contract_ids",
    "generated_work_item_ids",
    "command_search_record_id",
    "audit_event_ids",
  ],
} as const;

export const V10_MUTATION_CATALOG = [
  { name: "create_contract_import", auditAction: "contract_import.created", minimumRole: "viewer" },
  { name: "assign_work_item_owner", auditAction: "work_item.owner_changed", minimumRole: "editor" },
  { name: "complete_work_item", auditAction: "work_item.completed", minimumRole: "viewer" },
  { name: "bulk_assign_compatible_work_items", auditAction: "work_item.bulk_owner_changed", minimumRole: "ops_manager" },
  { name: "bulk_complete_compatible_work_items", auditAction: "work_item.bulk_completed", minimumRole: "ops_manager" },
  { name: "approve_field", auditAction: "contract_field.approved", minimumRole: "legal_reviewer" },
  { name: "reject_field", auditAction: "contract_field.rejected", minimumRole: "legal_reviewer" },
  { name: "edit_and_approve_field", auditAction: "contract_field.edited_and_approved", minimumRole: "legal_reviewer" },
  { name: "retry_failed_job", auditAction: "job.retry_requested", minimumRole: "viewer" },
  { name: "create_evidence_request", auditAction: "evidence_request.created", minimumRole: "editor" },
  { name: "submit_external_evidence", auditAction: "evidence_request.submitted", minimumRole: "external_token" },
  { name: "accept_evidence", auditAction: "evidence_request.accepted", minimumRole: "legal_reviewer" },
  { name: "reject_evidence", auditAction: "evidence_request.rejected", minimumRole: "legal_reviewer" },
  { name: "approve_approval_request", auditAction: "approval.approved", minimumRole: "viewer" },
  { name: "reject_approval_request", auditAction: "approval.rejected", minimumRole: "viewer" },
  { name: "request_approval_changes", auditAction: "approval.changes_requested", minimumRole: "viewer" },
  { name: "delegate_approval_request", auditAction: "approval.delegated", minimumRole: "ops_manager" },
  { name: "escalate_approval_request", auditAction: "approval.escalated", minimumRole: "ops_manager" },
  { name: "assign_exception_owner", auditAction: "exception.owner_changed", minimumRole: "editor" },
  { name: "resolve_exception", auditAction: "exception.resolved", minimumRole: "editor" },
  { name: "reopen_exception", auditAction: "exception.reopened", minimumRole: "ops_manager" },
  { name: "change_renewal_posture", auditAction: "renewal.posture_changed", minimumRole: "legal_reviewer" },
  { name: "generate_renewal_decision_packet", auditAction: "renewal.decision_packet_generated", minimumRole: "legal_reviewer" },
  { name: "record_renewal_recommendation", auditAction: "renewal.recommendation_recorded", minimumRole: "legal_reviewer" },
  { name: "create_report_run", auditAction: "report_run.created", minimumRole: "viewer" },
  { name: "create_export_job", auditAction: "export_job.created", minimumRole: "viewer" },
  { name: "update_notification_preferences", auditAction: "notification_preferences.updated", minimumRole: "viewer" },
  { name: "update_module_visibility", auditAction: "workspace.module_visibility_updated", minimumRole: "admin" },
  { name: "update_workspace_mode", auditAction: "workspace.mode_updated", minimumRole: "admin" },
] as const;

export const V10_ACCEPTANCE_GATES = [
  "activation",
  "work",
  "contract_record",
  "review_data_quality",
  "renewal",
  "evidence",
  "approval_exception",
  "search",
  "reporting",
  "workspace_governance",
  "reliability",
  "security_privacy",
  "accessibility",
  "performance",
  "data_contract",
  "objective_measurement",
] as const;

export const V10_RELEASE_PRIORITY_TIERS = {
  P0: [
    "quantified_objectives",
    "activation_state_machine",
    "unified_work_lenses_and_actions",
    "contract_header_next_action_health_audit",
    "field_review_provenance_data_quality",
    "renewal_posture_from_approved_dates",
    "evidence_request_external_submission",
    "approval_exception_actions",
    "core_command_palette_coverage",
    "core_reports_exports_job_visibility",
    "settings_roles_plan_module_health",
    "security_privacy_accessibility_performance",
    "data_api_contracts",
  ],
  P1: [
    "counterparty_account_relationship_summaries",
    "advanced_decisions_campaigns_simulations_programs_work_integration",
    "assurance_findings_controls_scorecards_playbooks_review_boards_health_graph_work_integration",
    "advanced_assurance_command_palette_coverage",
    "advanced_assurance_notification_coverage",
    "bulk_work_actions_beyond_assign_complete",
  ],
  P2: [
    "additional_report_families",
    "additional_automation_playbooks",
    "additional_relationship_timeline_visualizations",
    "predictive_scoring",
    "custom_workspace_defined_work_item_types",
  ],
} as const;

export const V10_ACCEPTANCE_GATE_RELEASE_SCOPE = [
  { gate: "activation", beta: true, ga: true, complete: true },
  { gate: "work", beta: true, ga: true, complete: true },
  { gate: "contract_record", beta: true, ga: true, complete: true },
  { gate: "review_data_quality", beta: true, ga: true, complete: true },
  { gate: "renewal", beta: true, ga: true, complete: true },
  { gate: "evidence", beta: true, ga: true, complete: true },
  { gate: "approval_exception", beta: true, ga: true, complete: true },
  { gate: "search", beta: true, ga: true, complete: true },
  { gate: "reporting", beta: true, ga: true, complete: true },
  { gate: "workspace_governance", beta: true, ga: true, complete: true },
  { gate: "reliability", beta: true, ga: true, complete: true },
  { gate: "security_privacy", beta: true, ga: true, complete: true },
  { gate: "accessibility", beta: true, ga: true, complete: true },
  { gate: "performance", beta: true, ga: true, complete: true },
  { gate: "data_contract", beta: true, ga: true, complete: true },
  { gate: "objective_measurement", beta: true, ga: true, complete: true },
] as const satisfies readonly {
  gate: (typeof V10_ACCEPTANCE_GATES)[number];
  beta: boolean;
  ga: boolean;
  complete: boolean;
}[];

export const V10_GA_SAMPLE_SIZES = {
  activation: 100,
  command_palette_search: 200,
  report_reliability: 100,
  export_reliability: 100,
  renewal_reminders: 100,
  evidence_follow_up: 100,
  work_reachability: 200,
  contract_record_trust: 50,
  recoverability: 50,
  usability_participants: 20,
  scripted_first_time_activation_sessions: 100,
} as const;

export const V10_RELEASE_FIXTURE_MINIMUMS = {
  core_workspaces: 5,
  advanced_workspaces: 3,
  assurance_workspaces: 3,
  contracts: 50,
  missing_required_field_contracts: 10,
  renewal_or_notice_inside_365_days: 10,
  unassigned_actionable_items: 10,
  overdue_items: 10,
  blocked_items: 10,
  evidence_requests: 10,
  report_runs: 10,
  export_jobs: 10,
} as const;

export const V10_RELEASE_STATES = [
  {
    state: "beta",
    requiredPriorities: ["P0"],
    requiresExternalEvidence: ["P0 metric results"],
  },
  {
    state: "GA",
    requiredPriorities: ["P0", "P1"],
    requiresExternalEvidence: ["P0 and P1 launch metric results", "post-GA dashboard existence"],
  },
  {
    state: "complete",
    requiredPriorities: ["P0", "P1", "included P2"],
    requiresExternalEvidence: ["GA evidence", "included P2 evidence"],
  },
] as const;

export const V10_OBJECTIVE_TARGETS = [
  {
    key: "first_contract_activation",
    measurementKey: "activation",
    target: "80_percent_valid_upload_or_import_to_first_work_item_under_10_minutes",
  },
  {
    key: "daily_action_clearance",
    measurementKey: "work_reachability",
    target: "95_percent_user_owned_actionable_items_reachable_in_two_clicks_or_fewer",
  },
  {
    key: "contract_record_trust",
    measurementKey: "contract_record_trust",
    target: "all_fixture_contract_detail_pages_show_v10_trust_header_above_first_fold",
  },
  {
    key: "evidence_accountability",
    measurementKey: "evidence_follow_up",
    target: "scheduled_reminders_overdue_owner_notification_and_escalation_work_items",
  },
  {
    key: "report_reliability",
    measurementKey: "report_reliability",
    target: "95_percent_standard_runs_complete_or_fail_retryable_under_2_minutes",
  },
  {
    key: "export_reliability",
    measurementKey: "export_reliability",
    target: "95_percent_exports_up_to_50000_rows_complete_or_fail_retryable_under_2_minutes",
  },
  {
    key: "search_as_router",
    measurementKey: "command_palette_search",
    target: "95_percent_exact_match_queries_return_destination_or_recovery_action",
  },
  {
    key: "in_app_recoverability",
    measurementKey: "recoverability",
    target: "every_recoverable_state_shows_reason_and_valid_next_action_or_explanation",
  },
  {
    key: "product_self_explanation",
    measurementKey: "usability_participants",
    target: "18_of_20_pre_ga_first_time_participants_complete_without_help_docs",
  },
] as const;

export const V10_NON_GOALS = [
  "new top-level navigation area",
  "new product family",
  "replacing existing architecture",
  "replacing existing workspace modes",
  "moving Advanced or Assurance functionality into Core without eligibility controls",
  "public exposure of paid or hidden features",
  "manual report assembly outside the product",
  "documentation deliverables as proof of completion",
  "training material as a prerequisite for completing core workflows",
  "silent automation that changes operational state",
  "telemetry containing raw contract text or uploaded document content",
] as const;

export type V10WorkItemType = (typeof V10_WORK_ITEM_TYPES)[number];
export type V10WorkItemStatus = (typeof V10_WORK_ITEM_STATUSES)[number];
export type V10DueState = (typeof V10_DUE_STATES)[number];
export type V10OwnerState = (typeof V10_OWNER_STATES)[number];
export type V10Priority = (typeof V10_PRIORITIES)[number];
export type V10Severity = (typeof V10_SEVERITIES)[number];
export type V10FieldState = (typeof V10_FIELD_STATES)[number];
export type V10ConfidenceState = (typeof V10_CONFIDENCE_STATES)[number];
export type V10RenewalPosture = (typeof V10_RENEWAL_POSTURES)[number];
export type V10JobStatus = (typeof V10_JOB_STATUSES)[number];
export type V10CancellationState = (typeof V10_CANCELLATION_STATES)[number];
export type V10MutationOutcome = (typeof V10_MUTATION_OUTCOMES)[number];
export type V10WorkspaceMode = (typeof V10_WORKSPACE_MODES)[number];
export type V10Role = (typeof V10_ROLES)[number];
export type V10Plan = (typeof V10_PLANS)[number];
export type V10VisibilityState = (typeof V10_VISIBILITY_STATES)[number];
export type V10SourceObjectType = (typeof V10_SOURCE_OBJECT_TYPES)[number];
export type V10ReportFamily = (typeof V10_CORE_REPORT_FAMILIES)[number];
export type V10JobClass = (typeof V10_JOB_CLASSES)[number];
export type V10NotificationClass = (typeof V10_NOTIFICATION_CLASSES)[number];
export type V10ActivationState = (typeof V10_ACTIVATION_STATES)[number];
export type V10RenewalHorizon = (typeof V10_RENEWAL_HORIZONS)[number];
export type V10WorkLens = (typeof V10_WORK_LENSES)[number];
export type V10WorkAction = (typeof V10_WORK_ACTIONS)[number];
export type V10HealthDeductionKey = (typeof V10_HEALTH_DEDUCTIONS)[number]["key"];
export type V10HealthBand = (typeof V10_HEALTH_BANDS)[number]["band"];
export type V10ContractNextAction = (typeof V10_CONTRACT_NEXT_ACTION_ORDER)[number];
export type V10AcceptanceGate = (typeof V10_ACCEPTANCE_GATES)[number];
export type V10ReleasePriority = keyof typeof V10_RELEASE_PRIORITY_TIERS;
export type V10ObjectiveTarget = (typeof V10_OBJECTIVE_TARGETS)[number];
