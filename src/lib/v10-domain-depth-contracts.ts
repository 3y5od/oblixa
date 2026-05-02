export type V10DepthContract = {
  key: string;
  owner: "engineering" | "product" | "security" | "support" | "release" | "operations";
  requirements: readonly string[];
};

export type V10DomainWorkflowSourceLink = {
  workflow:
    | "activation"
    | "review"
    | "task"
    | "renewal"
    | "evidence"
    | "obligation"
    | "approval"
    | "exception"
    | "report"
    | "export"
    | "job"
    | "notification"
    | "decision"
    | "relationship"
    | "advanced"
    | "assurance"
    | "shipped_p2";
  sourceObjectType: string;
  sourceTable: string;
  readModel: string;
  workItemType: string;
  primaryAction: string;
  auditAction: string;
  commandSearchRequired: boolean;
  reportExportInclusion: "required" | "eligible";
  notificationClass: string | null;
};

export const V10_JOURNEY_COVERAGE: readonly V10DepthContract[] = [
  { key: "first_activation", owner: "product", requirements: ["upload", "review", "first_work_item", "self_explanation", "recovery"] },
  { key: "daily_work", owner: "product", requirements: ["assigned", "team", "blocked", "high_risk", "bulk_action"] },
  { key: "renewal_prevention", owner: "product", requirements: ["horizon", "reminder", "owner_assignment", "completion", "audit"] },
  { key: "evidence_collection", owner: "product", requirements: ["external_link", "consent", "submit", "review", "follow_up"] },
  { key: "reporting_governance", owner: "release", requirements: ["run_report", "export", "scheduled_report", "settings_visibility", "diagnostics"] },
] as const;

export const V10_RUNTIME_OWNERSHIP: readonly V10DepthContract[] = [
  { key: "read_models", owner: "engineering", requirements: ["server_mapper_owner", "freshness_slo", "rebuild_path", "count_reconciliation"] },
  { key: "jobs", owner: "operations", requirements: ["queue_owner", "retry_policy", "stuck_job_detection", "diagnostic_id"] },
  { key: "notifications", owner: "operations", requirements: ["preference_respected", "delivery_state", "external_policy", "suppression_reason"] },
  { key: "release_evidence", owner: "release", requirements: ["freshness_window", "promotion_rule", "archive_rule", "invalidation_rule"] },
] as const;

export const V10_DATA_INTEGRITY: readonly V10DepthContract[] = [
  { key: "referential_integrity", owner: "engineering", requirements: ["no_orphan_work_items", "source_object_exists", "audit_reference_exists", "artifact_reference_exists"] },
  { key: "count_reconciliation", owner: "engineering", requirements: ["home_work_reports_match", "search_rows_match_sources", "notification_counts_match_deliveries", "release_metrics_match_locked_denominator"] },
  { key: "data_quality", owner: "product", requirements: ["duplicate_detection", "conflicting_dates", "missing_required_fields", "stale_source", "remediation_depth"] },
] as const;

export const V10_CONCURRENCY_CONTRACTS: readonly V10DepthContract[] = [
  { key: "mutations", owner: "engineering", requirements: ["idempotency_key", "expected_version", "duplicate_execution_prevented", "stale_version_response"] },
  { key: "jobs", owner: "operations", requirements: ["single_active_retry", "lock_timeout", "worker_loss_recovery", "queue_backlog_state"] },
  { key: "evidence", owner: "engineering", requirements: ["link_scope_lock", "revocation_race_safe", "duplicate_submit_safe", "review_version_check"] },
  { key: "automation", owner: "security", requirements: ["approval_lock", "revert_lock", "not_reversible_warning", "incident_stop"] },
] as const;

export const V10_PLAN_LIMIT_CONTRACTS: readonly V10DepthContract[] = [
  { key: "billing_state", owner: "product", requirements: ["trial", "core", "advanced", "assurance", "past_due", "grace_period"] },
  { key: "quotas", owner: "engineering", requirements: ["contracts", "members", "exports", "scheduled_reports", "external_links"] },
  { key: "limit_recovery", owner: "support", requirements: ["explain_limit", "safe_upgrade_link", "no_partial_mutation", "audit_denial"] },
] as const;

export const V10_THREAT_MODEL_CONTRACTS: readonly V10DepthContract[] = [
  { key: "external_links", owner: "security", requirements: ["scoped_token", "expiry", "revocation", "rate_limit", "consent"] },
  { key: "exports_reports", owner: "security", requirements: ["csv_injection", "signed_artifacts", "download_audit", "retention", "legal_hold"] },
  { key: "command_search", owner: "security", requirements: ["org_scope", "hidden_destination_filter", "rank_term_safety", "recent_cleanup"] },
  { key: "service_role_jobs", owner: "security", requirements: ["server_only", "job_scope", "redacted_logs", "circuit_breaker"] },
] as const;

export const V10_ROUTE_STATE_MATRIX: readonly V10DepthContract[] = [
  { key: "route_states", owner: "product", requirements: ["empty", "loading", "partial", "failed", "unauthorized", "forbidden", "plan_gated", "mode_gated", "hidden", "archived", "deleted", "no_action"] },
  { key: "http_policy", owner: "engineering", requirements: ["method_allowed", "cache_control_private", "sensitive_headers", "artifact_access", "external_route_scope"] },
] as const;

export const V10_RELEASE_OPERATIONS: readonly V10DepthContract[] = [
  { key: "runbooks", owner: "support", requirements: ["failure_owner", "remediation_category", "rerun_rule", "dashboard_freshness"] },
  { key: "change_control", owner: "release", requirements: ["freeze", "change_approval", "evidence_invalidation", "post_implementation_review"] },
  { key: "environment_prerequisites", owner: "release", requirements: ["dry_run", "fixture_promotion", "provider_access", "synthetic_monitoring"] },
  { key: "post_release_ops", owner: "operations", requirements: ["alert_review", "rollback", "evidence_archival", "support_diagnostics"] },
] as const;

export const V10_COMPONENT_CONTRACTS: readonly V10DepthContract[] = [
  { key: "badges", owner: "product", requirements: ["status_text", "tone", "tooltip", "screen_reader_label"] },
  { key: "cards_tables", owner: "product", requirements: ["empty_state", "loading_state", "pagination", "responsive"] },
  { key: "dialogs_drawers_forms", owner: "engineering", requirements: ["focus_return", "escape_close", "validation_summary", "destructive_confirmation"] },
  { key: "diagnostics_permission_hints", owner: "support", requirements: ["diagnostic_id", "safe_copy", "allowed_next_action", "denial_reason"] },
] as const;

export const V10_DOMAIN_WORKFLOW_SOURCE_LINKS: readonly V10DomainWorkflowSourceLink[] = [
  {
    workflow: "activation",
    sourceObjectType: "contract",
    sourceTable: "contracts",
    readModel: "activation_state",
    workItemType: "field_review",
    primaryAction: "open_first_work_item",
    auditAction: "activation.first_work_item_generated",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "review_backlog",
  },
  {
    workflow: "review",
    sourceObjectType: "field",
    sourceTable: "extracted_fields",
    readModel: "field_provenance_records",
    workItemType: "field_review",
    primaryAction: "review_field",
    auditAction: "field.reviewed",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "review_backlog",
  },
  {
    workflow: "task",
    sourceObjectType: "work_item",
    sourceTable: "contract_tasks",
    readModel: "work_items",
    workItemType: "contract_task",
    primaryAction: "mark_done",
    auditAction: "work_item.completed",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "due_work",
  },
  {
    workflow: "renewal",
    sourceObjectType: "renewal_checkpoint",
    sourceTable: "contract_renewal_checkpoints",
    readModel: "renewal_checkpoint_records",
    workItemType: "renewal_checkpoint",
    primaryAction: "complete_renewal_checkpoint",
    auditAction: "renewal_checkpoint.opened",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "renewal_horizon",
  },
  {
    workflow: "evidence",
    sourceObjectType: "evidence_request",
    sourceTable: "evidence_requirements",
    readModel: "evidence_request_statuses",
    workItemType: "evidence_request",
    primaryAction: "accept_evidence",
    auditAction: "evidence_request.accepted",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "evidence_request",
  },
  {
    workflow: "obligation",
    sourceObjectType: "obligation",
    sourceTable: "contract_obligations",
    readModel: "obligation_records",
    workItemType: "obligation",
    primaryAction: "mark_done",
    auditAction: "obligation.completed",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "due_work",
  },
  {
    workflow: "approval",
    sourceObjectType: "approval",
    sourceTable: "contract_approvals",
    readModel: "approval_records",
    workItemType: "approval",
    primaryAction: "approve_approval",
    auditAction: "approval.approved",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "pending_approval",
  },
  {
    workflow: "exception",
    sourceObjectType: "exception",
    sourceTable: "exceptions",
    readModel: "exception_records",
    workItemType: "exception",
    primaryAction: "resolve_exception",
    auditAction: "exception.resolved",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "exception_assignment",
  },
  {
    workflow: "report",
    sourceObjectType: "report_run",
    sourceTable: "report_runs",
    readModel: "report_run_visibility",
    workItemType: "report_failure",
    primaryAction: "create_report_run",
    auditAction: "report.generated",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "failed_report",
  },
  {
    workflow: "export",
    sourceObjectType: "export_job",
    sourceTable: "contract_export_jobs",
    readModel: "job_run_visibility",
    workItemType: "export_failure",
    primaryAction: "create_export_job",
    auditAction: "export.created",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "failed_export",
  },
  {
    workflow: "job",
    sourceObjectType: "import_job",
    sourceTable: "contract_import_jobs",
    readModel: "job_run_visibility",
    workItemType: "import_failure",
    primaryAction: "retry_failed_job",
    auditAction: "job.retry_requested",
    commandSearchRequired: true,
    reportExportInclusion: "eligible",
    notificationClass: "failed_import",
  },
  {
    workflow: "notification",
    sourceObjectType: "notification_delivery",
    sourceTable: "notification_deliveries",
    readModel: "notification_deliveries",
    workItemType: "notification_delivery",
    primaryAction: "update_notification_preferences",
    auditAction: "notification.preferences_updated",
    commandSearchRequired: true,
    reportExportInclusion: "eligible",
    notificationClass: "due_work",
  },
  {
    workflow: "decision",
    sourceObjectType: "decision",
    sourceTable: "decision_workspaces",
    readModel: "advanced_assurance_linked_records",
    workItemType: "automation_approval",
    primaryAction: "approve_approval",
    auditAction: "decision.linked",
    commandSearchRequired: true,
    reportExportInclusion: "eligible",
    notificationClass: "automation_approval_required",
  },
  {
    workflow: "relationship",
    sourceObjectType: "relationship",
    sourceTable: "portfolio_health_graph_edges",
    readModel: "advanced_assurance_linked_records",
    workItemType: "relationship_review",
    primaryAction: "open_relationship_workspace",
    auditAction: "relationship.reviewed",
    commandSearchRequired: true,
    reportExportInclusion: "eligible",
    notificationClass: "review_backlog",
  },
  {
    workflow: "advanced",
    sourceObjectType: "decision",
    sourceTable: "decision_workspaces",
    readModel: "advanced_assurance_linked_records",
    workItemType: "automation_approval",
    primaryAction: "approve_automation",
    auditAction: "advanced.automation_approved",
    commandSearchRequired: true,
    reportExportInclusion: "eligible",
    notificationClass: "automation_approval_required",
  },
  {
    workflow: "assurance",
    sourceObjectType: "finding",
    sourceTable: "assurance_findings",
    readModel: "advanced_assurance_linked_records",
    workItemType: "assurance_finding",
    primaryAction: "open_assurance_finding",
    auditAction: "assurance.finding_opened",
    commandSearchRequired: true,
    reportExportInclusion: "required",
    notificationClass: "review_backlog",
  },
  {
    workflow: "shipped_p2",
    sourceObjectType: "automation_run",
    sourceTable: "adaptive_playbook_runs",
    readModel: "advanced_assurance_linked_records",
    workItemType: "automation_approval",
    primaryAction: "approve_automation",
    auditAction: "automation.run_approved",
    commandSearchRequired: true,
    reportExportInclusion: "eligible",
    notificationClass: "automation_approval_required",
  },
] as const;

export const V10_DOMAIN_DEPTH_CONTRACTS = [
  ...V10_JOURNEY_COVERAGE,
  ...V10_RUNTIME_OWNERSHIP,
  ...V10_DATA_INTEGRITY,
  ...V10_CONCURRENCY_CONTRACTS,
  ...V10_PLAN_LIMIT_CONTRACTS,
  ...V10_THREAT_MODEL_CONTRACTS,
  ...V10_ROUTE_STATE_MATRIX,
  ...V10_RELEASE_OPERATIONS,
  ...V10_COMPONENT_CONTRACTS,
] as const;

export function v10DepthContractHasRequirement(key: string, requirement: string): boolean {
  return V10_DOMAIN_DEPTH_CONTRACTS.some((contract) => contract.key === key && contract.requirements.includes(requirement));
}

export function validateV10DomainWorkflowSourceLinks(
  rows: readonly V10DomainWorkflowSourceLink[] = V10_DOMAIN_WORKFLOW_SOURCE_LINKS
): string[] {
  const failures: string[] = [];
  const requiredWorkflows: readonly V10DomainWorkflowSourceLink["workflow"][] = [
    "activation",
    "review",
    "task",
    "renewal",
    "evidence",
    "obligation",
    "approval",
    "exception",
    "report",
    "export",
    "job",
    "notification",
    "decision",
    "relationship",
    "advanced",
    "assurance",
    "shipped_p2",
  ];
  for (const workflow of requiredWorkflows) {
    if (!rows.some((row) => row.workflow === workflow)) failures.push(`domain_source_link_missing:${workflow}`);
  }
  for (const row of rows) {
    if (!row.sourceObjectType) failures.push(`${row.workflow}:source_object_required`);
    if (!row.sourceTable) failures.push(`${row.workflow}:source_table_required`);
    if (!row.readModel) failures.push(`${row.workflow}:read_model_required`);
    if (!row.workItemType) failures.push(`${row.workflow}:work_item_required`);
    if (!row.primaryAction) failures.push(`${row.workflow}:primary_action_required`);
    if (!row.auditAction.includes(".")) failures.push(`${row.workflow}:audit_action_required`);
    if (!row.commandSearchRequired) failures.push(`${row.workflow}:command_search_required`);
    if (!row.notificationClass) failures.push(`${row.workflow}:notification_class_required`);
  }
  if (new Set(rows.map((row) => row.workflow)).size !== rows.length) failures.push("domain_source_link_duplicate");
  return failures;
}
