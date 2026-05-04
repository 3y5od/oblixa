import {
  V10_SOURCE_OBJECT_TYPES,
  type V10SourceObjectType,
} from "./v10-release-contract";
import { V10_REQUIRED_READ_MODEL_KEYS } from "./v10-read-models";

export type V10SourceObjectInventoryRow = {
  sourceObjectType: V10SourceObjectType;
  sourceTable: string;
  organizationScope: "required" | "external_token_scoped" | "release_evidence";
  ownerField: string | null;
  statusField: string | null;
  dueField: string | null;
  visibilityField: string | null;
  featureFamily: string;
  minimumMode: "core" | "advanced" | "assurance";
  workItemType: string | null;
  readModels: readonly string[];
  commandSearch: "required" | "eligible_when_visible" | "not_applicable";
  auditActions: readonly string[];
  telemetryObjectives: readonly string[];
  reportExportInclusion: "required" | "eligible" | "not_applicable";
  retentionPolicy: "source_retained" | "artifact_expiring" | "token_expiring" | "release_evidence";
  autonomousStatus: "runtime_verified" | "runtime_mapped" | "typed_contract" | "external_evidence";
  tests: readonly string[];
};

export type V10SourceObjectCoverageMatrixRow = {
  sourceObjectType: V10SourceObjectType;
  sourceTable: string;
  primaryReadModel: string;
  ownershipCoverage: "owner_field" | "system_owned" | "external_token_scoped" | "release_evidence";
  statusCoverage: "status_field" | "derived_status" | "not_applicable";
  dueCoverage: "due_field" | "derived_due_state" | "not_applicable";
  visibilityCoverage: "visibility_field" | "read_model_visibility" | "external_token_scope" | "not_applicable";
  generatesWork: boolean;
  workItemType: string | null;
  commandSearchCoverage: "required" | "eligible_when_visible" | "not_applicable";
  auditCoverage: "runtime_audited" | "external_blocker";
  telemetryCoverage: "objective_mapped";
  reportExportInclusion: V10SourceObjectInventoryRow["reportExportInclusion"];
  retentionPolicy: V10SourceObjectInventoryRow["retentionPolicy"];
  releaseEvidenceKey: string;
  proofTests: readonly string[];
};

export const V10_SOURCE_OBJECT_INVENTORY: readonly V10SourceObjectInventoryRow[] = [
  {
    sourceObjectType: "contract",
    sourceTable: "contracts",
    organizationScope: "required",
    ownerField: "owner_id",
    statusField: "status",
    dueField: null,
    visibilityField: "deleted_at",
    featureFamily: "contracts",
    minimumMode: "core",
    workItemType: "unassigned_work",
    readModels: ["activation_state", "work_items", "contract_health_snapshots", "contract_activity_events", "command_search_index"],
    commandSearch: "required",
    auditActions: ["contract.created", "contract.updated", "owner.assigned"],
    telemetryObjectives: ["activation_first_work_item", "contract_record_trust"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-data-contracts.v10.test.ts", "e2e/v10-core-smoke.spec.ts"],
  },
  {
    sourceObjectType: "work_item",
    sourceTable: "contract_tasks",
    organizationScope: "required",
    ownerField: "assignee_id",
    statusField: "status",
    dueField: "due_date",
    visibilityField: null,
    featureFamily: "work",
    minimumMode: "core",
    workItemType: "contract_task",
    readModels: ["work_items", "contract_health_snapshots", "command_search_index"],
    commandSearch: "required",
    auditActions: ["work_item.created", "work_item.completed", "work_item.bulk_completed"],
    telemetryObjectives: ["daily_action_clearance"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-semantics.v10.test.ts", "src/actions/tasks.ts"],
  },
  {
    sourceObjectType: "field",
    sourceTable: "extracted_fields",
    organizationScope: "required",
    ownerField: "reviewer_id",
    statusField: "approval_status",
    dueField: null,
    visibilityField: null,
    featureFamily: "review",
    minimumMode: "core",
    workItemType: "field_review",
    readModels: ["field_provenance_records", "work_items", "contract_health_snapshots", "command_search_index"],
    commandSearch: "eligible_when_visible",
    auditActions: ["contract_field.approved", "contract_field.rejected", "contract_field.edited_and_approved"],
    telemetryObjectives: ["activation_first_work_item"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-semantics.v10.test.ts", "src/actions/v4.ts"],
  },
  {
    sourceObjectType: "obligation",
    sourceTable: "contract_obligations",
    organizationScope: "required",
    ownerField: "owner_id",
    statusField: "status",
    dueField: "due_date",
    visibilityField: null,
    featureFamily: "work",
    minimumMode: "core",
    workItemType: "obligation",
    readModels: ["obligation_records", "work_items", "contract_health_snapshots", "command_search_index"],
    commandSearch: "required",
    auditActions: ["obligation.completed", "obligation.updated"],
    telemetryObjectives: ["daily_action_clearance"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-read-model-refresh.v10.test.ts"],
  },
  {
    sourceObjectType: "approval",
    sourceTable: "contract_approvals",
    organizationScope: "required",
    ownerField: "approver_id",
    statusField: "status",
    dueField: "due_at",
    visibilityField: null,
    featureFamily: "work",
    minimumMode: "core",
    workItemType: "approval",
    readModels: ["approval_records", "work_items", "contract_health_snapshots", "command_search_index"],
    commandSearch: "required",
    auditActions: ["approval.approved", "approval.rejected", "approval.changes_requested", "approval.delegated"],
    telemetryObjectives: ["daily_action_clearance"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/app/api/approvals/[id]/[action]/route.test.ts"],
  },
  {
    sourceObjectType: "exception",
    sourceTable: "exceptions",
    organizationScope: "required",
    ownerField: "owner_id",
    statusField: "status",
    dueField: "due_date",
    visibilityField: null,
    featureFamily: "exceptions",
    minimumMode: "core",
    workItemType: "exception",
    readModels: ["exception_records", "work_items", "contract_health_snapshots", "command_search_index"],
    commandSearch: "required",
    auditActions: ["exception.owner_changed", "exception.resolved", "exception.reopened"],
    telemetryObjectives: ["daily_action_clearance"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/app/api/exceptions/[id]/[action]/route.test.ts"],
  },
  {
    sourceObjectType: "evidence_request",
    sourceTable: "evidence_requirements",
    organizationScope: "required",
    ownerField: "reviewer_id",
    statusField: "status",
    dueField: "due_at",
    visibilityField: null,
    featureFamily: "evidence",
    minimumMode: "core",
    workItemType: "evidence_request",
    readModels: ["evidence_request_statuses", "work_items", "external_evidence_submissions", "command_search_index"],
    commandSearch: "required",
    auditActions: ["evidence_request.created", "evidence_request.submitted", "evidence_request.accepted", "evidence_request.rejected", "evidence_request.follow_up_scheduled"],
    telemetryObjectives: ["evidence_accountability"],
    reportExportInclusion: "required",
    retentionPolicy: "token_expiring",
    autonomousStatus: "runtime_verified",
    tests: [
      "src/app/api/evidence/requests/route.test.ts",
      "src/app/api/evidence/[id]/[action]/route.test.ts",
      "src/app/api/cron/v4/evidence-followup/route.test.ts",
    ],
  },
  {
    sourceObjectType: "external_evidence_submission",
    sourceTable: "evidence_submissions",
    organizationScope: "external_token_scoped",
    ownerField: null,
    statusField: "status",
    dueField: null,
    visibilityField: "revoked_at",
    featureFamily: "evidence",
    minimumMode: "core",
    workItemType: null,
    readModels: ["external_evidence_submissions", "evidence_request_statuses"],
    commandSearch: "not_applicable",
    auditActions: ["evidence_submission.created", "evidence_submission.accepted", "evidence_submission.rejected"],
    telemetryObjectives: ["evidence_accountability"],
    reportExportInclusion: "eligible",
    retentionPolicy: "token_expiring",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-read-model-refresh.v10.test.ts", "src/app/api/evidence/[id]/[action]/route.test.ts"],
  },
  {
    sourceObjectType: "report_run",
    sourceTable: "report_runs",
    organizationScope: "required",
    ownerField: "triggered_by",
    statusField: "status",
    dueField: null,
    visibilityField: null,
    featureFamily: "reports",
    minimumMode: "core",
    workItemType: "report_failure",
    readModels: ["report_run_visibility", "work_items", "command_search_index"],
    commandSearch: "required",
    auditActions: ["report_run.created", "report_run.completed"],
    telemetryObjectives: ["report_export_reliability"],
    reportExportInclusion: "required",
    retentionPolicy: "artifact_expiring",
    autonomousStatus: "runtime_verified",
    tests: [
      "src/lib/v10-read-model-refresh.v10.test.ts",
      "src/app/api/cron/v4/report-packs-generate/route.test.ts",
      "src/app/api/report-runs/[runId]/retry/route.test.ts",
    ],
  },
  {
    sourceObjectType: "export_job",
    sourceTable: "contract_export_jobs",
    organizationScope: "required",
    ownerField: "created_by",
    statusField: "status",
    dueField: null,
    visibilityField: null,
    featureFamily: "exports",
    minimumMode: "core",
    workItemType: "export_failure",
    readModels: ["job_run_visibility", "work_items", "command_search_index"],
    commandSearch: "required",
    auditActions: ["export_job.created", "export_job.completed"],
    telemetryObjectives: ["report_export_reliability"],
    reportExportInclusion: "required",
    retentionPolicy: "artifact_expiring",
    autonomousStatus: "runtime_verified",
    tests: ["src/app/api/export/contracts/route.test.ts", "src/app/api/export/contracts/[jobId]/route.test.ts"],
  },
  {
    sourceObjectType: "import_job",
    sourceTable: "contract_import_jobs",
    organizationScope: "required",
    ownerField: "created_by",
    statusField: "status",
    dueField: null,
    visibilityField: null,
    featureFamily: "intake",
    minimumMode: "core",
    workItemType: "import_failure",
    readModels: ["job_run_visibility", "activation_state", "work_items", "command_search_index"],
    commandSearch: "required",
    auditActions: ["import_job.created", "import_job.retry_created"],
    telemetryObjectives: ["activation_first_work_item"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/app/api/import/contracts/route.test.ts", "src/app/api/import/contracts/[jobId]/route.test.ts"],
  },
  {
    sourceObjectType: "extraction_job",
    sourceTable: "contract_extraction_jobs",
    organizationScope: "required",
    ownerField: null,
    statusField: "status",
    dueField: null,
    visibilityField: null,
    featureFamily: "intake",
    minimumMode: "core",
    workItemType: "extraction_failure",
    readModels: ["job_run_visibility", "activation_state", "work_items", "command_search_index"],
    commandSearch: "required",
    auditActions: ["extraction_job.created", "extraction_job.retry_created"],
    telemetryObjectives: ["activation_first_work_item"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-read-model-refresh.v10.test.ts", "src/app/api/cron/v10/read-model-refresh/route.test.ts"],
  },
  {
    sourceObjectType: "file_upload",
    sourceTable: "contract_files",
    organizationScope: "required",
    ownerField: "uploaded_by",
    statusField: null,
    dueField: null,
    visibilityField: null,
    featureFamily: "intake",
    minimumMode: "core",
    workItemType: null,
    readModels: ["activation_state", "command_search_index"],
    commandSearch: "eligible_when_visible",
    auditActions: ["file_upload.accepted", "file_upload.rejected", "file_upload.deleted"],
    telemetryObjectives: ["activation_first_work_item"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/app/api/import/contracts/route.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
  },
  {
    sourceObjectType: "automation_run",
    sourceTable: "adaptive_playbook_runs",
    organizationScope: "required",
    ownerField: "run_by",
    statusField: "status",
    dueField: null,
    visibilityField: null,
    featureFamily: "playbooks",
    minimumMode: "assurance",
    workItemType: "automation_approval",
    readModels: ["advanced_assurance_linked_records", "work_items", "command_search_index"],
    commandSearch: "eligible_when_visible",
    auditActions: ["automation.approved", "automation.executed", "automation.reverted"],
    telemetryObjectives: ["daily_action_clearance"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-continuity.v10.test.ts"],
  },
  {
    sourceObjectType: "audit_event",
    sourceTable: "v10_audit_events",
    organizationScope: "required",
    ownerField: "actor_id",
    statusField: "outcome",
    dueField: null,
    visibilityField: null,
    featureFamily: "audit",
    minimumMode: "core",
    workItemType: null,
    readModels: ["audit_events", "contract_activity_events"],
    commandSearch: "not_applicable",
    auditActions: ["audit_event.recorded"],
    telemetryObjectives: ["contract_record_trust"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-data-contracts.v10.test.ts", "src/lib/v10-server-contracts.v10.test.ts"],
  },
  {
    sourceObjectType: "notification_delivery",
    sourceTable: "notification_deliveries",
    organizationScope: "required",
    ownerField: null,
    statusField: "status",
    dueField: "next_attempt_at",
    visibilityField: null,
    featureFamily: "settings",
    minimumMode: "core",
    workItemType: null,
    readModels: ["notification_deliveries", "command_search_index"],
    commandSearch: "eligible_when_visible",
    auditActions: ["notification.delivery_attempted", "notification.delivery_failed"],
    telemetryObjectives: ["evidence_accountability", "renewal_prevention"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-data-contracts.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
  },
  {
    sourceObjectType: "reminder",
    sourceTable: "reminders",
    organizationScope: "required",
    ownerField: "user_id",
    statusField: "sent_at",
    dueField: "reminder_date",
    visibilityField: null,
    featureFamily: "renewals",
    minimumMode: "core",
    workItemType: null,
    readModels: ["command_search_index"],
    commandSearch: "eligible_when_visible",
    auditActions: ["reminder.generated", "reminder.suppressed"],
    telemetryObjectives: ["renewal_prevention"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-read-model-refresh.v10.test.ts"],
  },
  {
    sourceObjectType: "renewal_checkpoint",
    sourceTable: "contract_renewal_checkpoints",
    organizationScope: "required",
    ownerField: "owner_id",
    statusField: "status",
    dueField: "due_date",
    visibilityField: null,
    featureFamily: "renewals",
    minimumMode: "core",
    workItemType: "renewal_checkpoint",
    readModels: ["renewal_checkpoint_records", "renewal_posture_snapshots", "work_items", "command_search_index"],
    commandSearch: "required",
    auditActions: ["renewal.posture_changed", "renewal_checkpoint.opened"],
    telemetryObjectives: ["renewal_prevention"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/app/api/renewals/[id]/[action]/route.test.ts"],
  },
  ...([
    {
      sourceObjectType: "finding",
      sourceTable: "assurance_findings",
      ownerField: null,
      statusField: "status",
      featureFamily: "findings",
      minimumMode: "assurance",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "control",
      sourceTable: "control_policies",
      ownerField: null,
      statusField: "status",
      featureFamily: "control_policies",
      minimumMode: "assurance",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "campaign",
      sourceTable: "portfolio_campaigns",
      ownerField: "owner_user_id",
      statusField: "status",
      featureFamily: "campaigns",
      minimumMode: "advanced",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "decision",
      sourceTable: "decision_workspaces",
      ownerField: "owner_user_id",
      statusField: "status",
      featureFamily: "decisions",
      minimumMode: "advanced",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "simulation",
      sourceTable: "change_simulations",
      ownerField: "owner_user_id",
      statusField: "status",
      featureFamily: "compare_views",
      minimumMode: "advanced",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "program",
      sourceTable: "contract_programs",
      ownerField: null,
      statusField: "state",
      featureFamily: "programs",
      minimumMode: "advanced",
      readModels: ["command_search_index"],
      autonomousStatus: "runtime_verified" as const,
      tests: ["src/lib/v10-read-model-refresh.v10.test.ts", "src/lib/v10-continuity.v10.test.ts"],
    },
    {
      sourceObjectType: "scorecard",
      sourceTable: "assurance_scorecards",
      ownerField: "owner_user_id",
      statusField: "status",
      featureFamily: "scorecards",
      minimumMode: "assurance",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "playbook",
      sourceTable: "adaptive_playbook_runs",
      ownerField: "run_by",
      statusField: "status",
      featureFamily: "playbooks",
      minimumMode: "assurance",
      readModels: ["advanced_assurance_linked_records", "work_items", "command_search_index"],
      workItemType: "automation_approval" as const,
    },
    {
      sourceObjectType: "review_board",
      sourceTable: "review_boards",
      ownerField: "owner_user_id",
      statusField: "status",
      featureFamily: "review_boards",
      minimumMode: "assurance",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "health_graph",
      sourceTable: "portfolio_health_graph_edges",
      ownerField: null,
      statusField: null,
      featureFamily: "health_graph",
      minimumMode: "assurance",
      readModels: ["advanced_assurance_linked_records", "command_search_index"],
    },
    {
      sourceObjectType: "segment",
      sourceTable: "segment_definitions",
      ownerField: null,
      statusField: "active",
      featureFamily: "segments",
      minimumMode: "assurance",
      readModels: ["command_search_index"],
    },
    {
      sourceObjectType: "program_evolution",
      sourceTable: "program_evolution_experiments",
      ownerField: null,
      statusField: "status",
      featureFamily: "program_evolution",
      minimumMode: "assurance",
      readModels: ["command_search_index"],
    },
  ] as const).map((row): V10SourceObjectInventoryRow => ({
    organizationScope: "required" as const,
    dueField: null,
    visibilityField: null,
    workItemType: null,
    commandSearch: "eligible_when_visible" as const,
    auditActions: [`${row.sourceObjectType}.linked`],
    telemetryObjectives: ["daily_action_clearance"],
    reportExportInclusion: "eligible" as const,
    retentionPolicy: "source_retained" as const,
    autonomousStatus: "runtime_verified" as const,
    tests: ["src/lib/v10-read-model-refresh.v10.test.ts"],
    ...row,
  })),
  {
    sourceObjectType: "account",
    sourceTable: "account_workspaces",
    organizationScope: "required",
    ownerField: "owner_user_id",
    statusField: null,
    dueField: null,
    visibilityField: null,
    featureFamily: "relationship_workspaces",
    minimumMode: "advanced",
    workItemType: null,
    readModels: ["advanced_assurance_linked_records", "command_search_index"],
    commandSearch: "required",
    auditActions: ["account.workspace_viewed"],
    telemetryObjectives: ["contract_record_trust"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-domain-depth-contracts.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
  },
  {
    sourceObjectType: "counterparty",
    sourceTable: "counterparty_workspaces",
    organizationScope: "required",
    ownerField: "owner_user_id",
    statusField: null,
    dueField: null,
    visibilityField: null,
    featureFamily: "relationship_workspaces",
    minimumMode: "advanced",
    workItemType: null,
    readModels: ["advanced_assurance_linked_records", "command_search_index"],
    commandSearch: "required",
    auditActions: ["counterparty.workspace_viewed"],
    telemetryObjectives: ["contract_record_trust"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-domain-depth-contracts.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
  },
  {
    sourceObjectType: "relationship",
    sourceTable: "counterparty_workspaces",
    organizationScope: "required",
    ownerField: "owner_user_id",
    statusField: null,
    dueField: null,
    visibilityField: null,
    featureFamily: "relationship_workspaces",
    minimumMode: "advanced",
    workItemType: null,
    readModels: ["advanced_assurance_linked_records", "command_search_index"],
    commandSearch: "eligible_when_visible",
    auditActions: ["relationship.workspace_viewed"],
    telemetryObjectives: ["contract_record_trust"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-domain-depth-contracts.v10.test.ts", "src/lib/v10-read-model-refresh.v10.test.ts"],
  },
  {
    sourceObjectType: "saved_view",
    sourceTable: "saved_views",
    organizationScope: "required",
    ownerField: "created_by",
    statusField: null,
    dueField: null,
    visibilityField: null,
    featureFamily: "contracts",
    minimumMode: "core",
    workItemType: null,
    readModels: ["command_search_index"],
    commandSearch: "required",
    auditActions: ["saved_view.created"],
    telemetryObjectives: ["search_as_router"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/app/api/command-palette/contracts/route.v10.test.ts"],
  },
  {
    sourceObjectType: "setting",
    sourceTable: "organization_workflow_settings",
    organizationScope: "required",
    ownerField: null,
    statusField: null,
    dueField: null,
    visibilityField: null,
    featureFamily: "settings",
    minimumMode: "core",
    workItemType: null,
    readModels: ["command_search_index", "audit_events"],
    commandSearch: "required",
    auditActions: ["workspace.module_visibility_updated", "workspace.mode_updated"],
    telemetryObjectives: ["empty_state_cta"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/actions/product-surface-settings.test.ts"],
  },
  {
    sourceObjectType: "setting_destination",
    sourceTable: "organization_workflow_settings",
    organizationScope: "required",
    ownerField: null,
    statusField: null,
    dueField: null,
    visibilityField: null,
    featureFamily: "settings",
    minimumMode: "core",
    workItemType: null,
    readModels: ["command_search_index", "audit_events"],
    commandSearch: "required",
    auditActions: ["setting_destination.created", "setting_destination.updated", "setting_destination.disabled"],
    telemetryObjectives: ["empty_state_cta"],
    reportExportInclusion: "eligible",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/actions/product-surface-settings.test.ts", "src/lib/v10-operational-contracts.v10.test.ts"],
  },
  {
    sourceObjectType: "workspace_health_diagnostic",
    sourceTable: "v10_read_model_refresh_jobs",
    organizationScope: "required",
    ownerField: null,
    statusField: "status",
    dueField: null,
    visibilityField: null,
    featureFamily: "settings",
    minimumMode: "core",
    workItemType: null,
    readModels: ["command_search_index"],
    commandSearch: "eligible_when_visible",
    auditActions: ["workspace_health.diagnostic_created"],
    telemetryObjectives: ["empty_state_cta"],
    reportExportInclusion: "required",
    retentionPolicy: "source_retained",
    autonomousStatus: "runtime_verified",
    tests: ["src/lib/v10-read-model-refresh.v10.test.ts", "src/app/api/cron/v10/read-model-refresh/route.test.ts"],
  },
  {
    sourceObjectType: "billing_sync",
    sourceTable: "billing_sync_jobs",
    organizationScope: "release_evidence",
    ownerField: "triggered_by",
    statusField: "status",
    dueField: null,
    visibilityField: null,
    featureFamily: "billing",
    minimumMode: "core",
    workItemType: null,
    readModels: ["job_run_visibility", "audit_events"],
    commandSearch: "eligible_when_visible",
    auditActions: ["billing_sync.started", "billing_sync.completed", "billing_sync.failed"],
    telemetryObjectives: ["empty_state_cta"],
    reportExportInclusion: "eligible",
    retentionPolicy: "release_evidence",
    autonomousStatus: "external_evidence",
    tests: ["src/lib/v10-operational-contracts.v10.test.ts", "src/lib/v10-release-evidence.v10.test.ts"],
  },
  {
    sourceObjectType: "runtime_artifact",
    sourceTable: "v10_runtime_artifacts",
    organizationScope: "required",
    ownerField: "created_by",
    statusField: "status",
    dueField: "expires_at",
    visibilityField: "revoked_at",
    featureFamily: "runtime_artifacts",
    minimumMode: "core",
    workItemType: null,
    readModels: ["audit_events", "job_run_visibility", "report_run_visibility"],
    commandSearch: "not_applicable",
    auditActions: ["runtime_artifact.created", "runtime_artifact.revoked", "runtime_artifact.expired"],
    telemetryObjectives: ["report_export_reliability"],
    reportExportInclusion: "eligible",
    retentionPolicy: "artifact_expiring",
    autonomousStatus: "runtime_verified",
    tests: [
      "src/lib/v10-read-model-refresh.v10.test.ts",
      "src/lib/v10-mutation-rollout.v10.test.ts",
      "src/lib/v10-hardening-contracts.v10.test.ts",
    ],
  },
] as const;

export function getV10SourceObjectInventoryRow(
  sourceObjectType: V10SourceObjectType
): V10SourceObjectInventoryRow | null {
  return V10_SOURCE_OBJECT_INVENTORY.find((row) => row.sourceObjectType === sourceObjectType) ?? null;
}

export function buildV10SourceObjectCoverageMatrix(
  rows: readonly V10SourceObjectInventoryRow[] = V10_SOURCE_OBJECT_INVENTORY
): V10SourceObjectCoverageMatrixRow[] {
  return rows.map((row) => ({
    sourceObjectType: row.sourceObjectType,
    sourceTable: row.sourceTable,
    primaryReadModel: row.readModels[0] ?? "missing",
    ownershipCoverage:
      row.organizationScope === "external_token_scoped"
        ? "external_token_scoped"
        : row.organizationScope === "release_evidence"
          ? "release_evidence"
          : row.ownerField
            ? "owner_field"
            : "system_owned",
    statusCoverage: row.statusField ? "status_field" : row.readModels.includes("work_items") || row.readModels.includes("job_run_visibility") ? "derived_status" : "not_applicable",
    dueCoverage: row.dueField ? "due_field" : row.workItemType || row.readModels.includes("work_items") ? "derived_due_state" : "not_applicable",
    visibilityCoverage:
      row.visibilityField
        ? "visibility_field"
        : row.organizationScope === "external_token_scoped"
          ? "external_token_scope"
          : row.readModels.includes("command_search_index") || row.readModels.includes("work_items")
            ? "read_model_visibility"
            : "not_applicable",
    generatesWork: Boolean(row.workItemType),
    workItemType: row.workItemType,
    commandSearchCoverage: row.commandSearch,
    auditCoverage: row.autonomousStatus === "external_evidence" ? "external_blocker" : "runtime_audited",
    telemetryCoverage: "objective_mapped",
    reportExportInclusion: row.reportExportInclusion,
    retentionPolicy: row.retentionPolicy,
    releaseEvidenceKey: `source_object:${row.sourceObjectType}`,
    proofTests: row.tests,
  }));
}

export function validateV10SourceObjectCoverageMatrix(
  matrix: readonly V10SourceObjectCoverageMatrixRow[] = buildV10SourceObjectCoverageMatrix()
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const row of matrix) {
    if (seen.has(row.sourceObjectType)) failures.push(`duplicate_matrix_source:${row.sourceObjectType}`);
    seen.add(row.sourceObjectType);
    if (!row.sourceTable) failures.push(`${row.sourceObjectType}:matrix_source_table_required`);
    if (!row.primaryReadModel || row.primaryReadModel === "missing") failures.push(`${row.sourceObjectType}:matrix_primary_read_model_required`);
    if (!row.ownershipCoverage) failures.push(`${row.sourceObjectType}:matrix_ownership_required`);
    if (!row.statusCoverage) failures.push(`${row.sourceObjectType}:matrix_status_required`);
    if (!row.dueCoverage) failures.push(`${row.sourceObjectType}:matrix_due_required`);
    if (!row.visibilityCoverage) failures.push(`${row.sourceObjectType}:matrix_visibility_required`);
    if (row.generatesWork && !row.workItemType) failures.push(`${row.sourceObjectType}:matrix_work_item_type_required`);
    if (row.commandSearchCoverage === "required" && row.primaryReadModel !== "command_search_index") {
      const inventoryRow = getV10SourceObjectInventoryRow(row.sourceObjectType);
      if (!inventoryRow?.readModels.includes("command_search_index")) {
        failures.push(`${row.sourceObjectType}:matrix_command_search_required`);
      }
    }
    if (!row.releaseEvidenceKey.startsWith("source_object:")) failures.push(`${row.sourceObjectType}:matrix_release_evidence_key_required`);
    if (row.proofTests.length === 0) failures.push(`${row.sourceObjectType}:matrix_proof_required`);
    if (row.reportExportInclusion === "required" && row.retentionPolicy === "release_evidence") {
      failures.push(`${row.sourceObjectType}:release_evidence_source_cannot_be_required_export`);
    }
  }
  for (const type of V10_SOURCE_OBJECT_TYPES) {
    if (!seen.has(type)) failures.push(`missing_matrix_source_object:${type}`);
  }
  return failures;
}

export function validateV10SourceObjectInventory(
  rows: readonly V10SourceObjectInventoryRow[] = V10_SOURCE_OBJECT_INVENTORY
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  const canonicalReadModels = new Set<string>(V10_REQUIRED_READ_MODEL_KEYS);
  for (const row of rows) {
    if (seen.has(row.sourceObjectType)) failures.push(`duplicate_source_object:${row.sourceObjectType}`);
    seen.add(row.sourceObjectType);
    if (!row.sourceTable) failures.push(`${row.sourceObjectType}:source_table_required`);
    if (row.organizationScope === "required" && !row.sourceTable) failures.push(`${row.sourceObjectType}:org_source_required`);
    if (row.readModels.length === 0) failures.push(`${row.sourceObjectType}:read_model_required`);
    if (row.commandSearch === "required" && row.readModels.includes("command_search_index") === false) {
      failures.push(`${row.sourceObjectType}:command_search_index_required`);
    }
    for (const model of row.readModels) {
      if (!canonicalReadModels.has(model)) failures.push(`${row.sourceObjectType}:unknown_read_model:${model}`);
    }
    if (row.workItemType && !row.readModels.includes("work_items")) {
      failures.push(`${row.sourceObjectType}:work_source_missing_work_items_model`);
    }
    if (row.retentionPolicy === "artifact_expiring" && row.readModels.includes("job_run_visibility") === false && row.readModels.includes("report_run_visibility") === false) {
      failures.push(`${row.sourceObjectType}:artifact_retention_missing_visibility_model`);
    }
    if (row.auditActions.length === 0) failures.push(`${row.sourceObjectType}:audit_action_required`);
    if (row.telemetryObjectives.length === 0) failures.push(`${row.sourceObjectType}:telemetry_objective_required`);
    if (row.tests.length === 0) failures.push(`${row.sourceObjectType}:test_required`);
    if (row.autonomousStatus === "typed_contract") failures.push(`${row.sourceObjectType}:typed_contract_source_object_not_runtime_backed`);
  }
  for (const type of V10_SOURCE_OBJECT_TYPES) {
    if (!seen.has(type)) failures.push(`missing_source_object:${type}`);
  }
  return failures;
}
