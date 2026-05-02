import type {
  V10ActivationState,
  V10CancellationState,
  V10ConfidenceState,
  V10DueState,
  V10FieldState,
  V10JobClass,
  V10JobStatus,
  V10NotificationClass,
  V10OwnerState,
  V10Plan,
  V10Priority,
  V10RenewalHorizon,
  V10RenewalPosture,
  V10ReportFamily,
  V10Severity,
  V10SourceObjectType,
  V10VisibilityState,
  V10WorkspaceMode,
  V10Role,
  V10WorkItemStatus,
  V10WorkItemType,
} from "./v10-release-contract";
import { V10_READ_MODEL_FIELDS, V10_SHARED_READ_MODEL_FIELDS } from "./v10-release-contract";
import {
  applyV10CommandSearchVisibility,
  applyV10ReadModelVisibility,
} from "./v10-visibility";

export type V10SharedReadModelFields = {
  id: string;
  organization_id: string;
  workspace_mode: V10WorkspaceMode;
  required_role_minimum: V10Role;
  feature_family: string;
  source_table: string;
  source_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  archived_at: string | null;
  visibility_state: V10VisibilityState;
};

export type V10WorkItemReadModel = V10SharedReadModelFields & {
  type: V10WorkItemType;
  status: V10WorkItemStatus;
  title: string;
  contract_id: string | null;
  source_type: V10SourceObjectType;
  owner_user_id: string | null;
  owner_state: V10OwnerState;
  due_at: string | null;
  due_state: V10DueState;
  priority: V10Priority;
  severity: V10Severity;
  blocked_reason: string | null;
  primary_action: string;
  secondary_actions: string[];
  compatible_action_group: string;
  last_state_change_at: string;
  last_state_change_actor_id: string | null;
  audit_event_id: string | null;
};

export type V10ActivationStateReadModel = V10SharedReadModelFields & {
  user_id: string;
  contract_id: string | null;
  state: V10ActivationState;
  accepted_upload_at: string | null;
  extraction_started_at: string | null;
  extraction_completed_at: string | null;
  required_fields_total: number;
  required_fields_approved: number;
  owner_state: V10OwnerState;
  first_generated_work_item_id: string | null;
  first_generated_work_item_at: string | null;
  blocked_reason: string | null;
  next_action: string;
};

export type V10ContractHealthSnapshotReadModel = V10SharedReadModelFields & {
  contract_id: string;
  score: number;
  band: "healthy" | "watch" | "at_risk" | "critical";
  deductions: Array<{
    key: string;
    points: number;
    source_type: V10SourceObjectType | null;
    source_id: string | null;
  }>;
  next_action: string;
  computed_at: string;
  stale_owner: boolean;
  missing_required_field_count: number;
  missing_critical_date_count: number;
  overdue_work_count: number;
  open_high_or_critical_exception_count: number;
  outstanding_evidence_count: number;
  failed_or_partial_job_count: number;
};

export type V10ContractActivityEventReadModel = V10SharedReadModelFields & {
  contract_id: string;
  actor_user_id: string | null;
  actor_display: string;
  action: string;
  target_type: V10SourceObjectType;
  target_id: string;
  outcome: string;
  safe_summary: string;
  metadata_safe: Record<string, string | number | boolean | null>;
  occurred_at: string;
};

export type V10FieldProvenanceRecordReadModel = V10SharedReadModelFields & {
  contract_id: string;
  field_key: string;
  current_value_display: string;
  value_hash: string | null;
  state: V10FieldState;
  source_label: string;
  source_file_id: string | null;
  confidence_state: V10ConfidenceState;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  last_modified_actor_id: string | null;
  last_modified_at: string;
};

export type V10RenewalPostureSnapshotReadModel = V10SharedReadModelFields & {
  contract_id: string;
  posture: V10RenewalPosture;
  horizon: V10RenewalHorizon | null;
  approved_end_date: string | null;
  approved_renewal_date: string | null;
  approved_notice_deadline: string | null;
  reminder_eligible: boolean;
  blocked_reason: string | null;
  next_checkpoint_work_item_id: string | null;
  computed_at: string;
};

export type V10EvidenceRequestStatusReadModel = V10SharedReadModelFields & {
  evidence_request_id: string;
  contract_id: string | null;
  requester_user_id: string | null;
  external_responder_state: "provided" | "not_provided" | "redacted";
  due_at: string | null;
  status: string;
  submission_count: number;
  latest_submission_at: string | null;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  resubmission_allowed: boolean;
  external_link_state: "active" | "expired" | "revoked" | "not_created";
  audit_event_ids: string[];
};

export type V10ObligationRecordReadModel = V10SharedReadModelFields & {
  obligation_id: string;
  contract_id: string;
  title: string;
  owner_user_id: string | null;
  owner_state: V10OwnerState;
  status: string;
  due_at: string | null;
  due_state: V10DueState;
  source_field_key: string | null;
  source_clause_hash: string | null;
  evidence_required: boolean;
  evidence_request_ids: string[];
  linked_exception_ids: string[];
  last_activity_at: string | null;
  audit_event_ids: string[];
};

export type V10ApprovalRecordReadModel = V10SharedReadModelFields & {
  approval_id: string;
  contract_id: string;
  approval_type: string;
  requester_user_id: string | null;
  approver_user_id: string | null;
  delegated_approver_user_id: string | null;
  status: string;
  due_at: string | null;
  due_state: V10DueState;
  sla_state: string;
  decision_note_state: "provided" | "not_provided" | "redacted";
  decided_at: string | null;
  linked_decision_id: string | null;
  audit_event_ids: string[];
};

export type V10ExceptionRecordReadModel = V10SharedReadModelFields & {
  exception_id: string;
  contract_id: string;
  title: string;
  severity: V10Severity;
  owner_user_id: string | null;
  owner_state: V10OwnerState;
  status: string;
  root_cause: string | null;
  due_at: string | null;
  due_state: V10DueState;
  source_type: V10SourceObjectType;
  linked_source_id: string | null;
  resolution_action: string | null;
  resolved_at: string | null;
  reopened_at: string | null;
  linked_task_ids: string[];
  linked_evidence_request_ids: string[];
  linked_approval_id: string | null;
  linked_decision_id: string | null;
  audit_event_ids: string[];
};

export type V10NotificationDeliveryReadModel = V10SharedReadModelFields & {
  notification_id: string;
  notification_class: V10NotificationClass;
  recipient_user_id: string | null;
  recipient_channel: string;
  source_type: V10SourceObjectType;
  linked_source_id: string;
  contract_id: string | null;
  eligibility_state: string;
  preference_state: string;
  scheduled_at: string | null;
  sent_at: string | null;
  delivery_status: string;
  failure_category: string | null;
  diagnostic_id: string | null;
  deep_link_href: string | null;
  audit_event_id: string | null;
};

export type V10RenewalCheckpointRecordReadModel = V10SharedReadModelFields & {
  renewal_checkpoint_id: string;
  contract_id: string;
  checkpoint_type: string;
  owner_user_id: string | null;
  owner_state: V10OwnerState;
  status: string;
  due_at: string | null;
  due_state: V10DueState;
  approved_notice_deadline: string | null;
  approved_renewal_date: string | null;
  posture_before: V10RenewalPosture | null;
  posture_after: V10RenewalPosture | null;
  reminder_eligible: boolean;
  blocked_reason: string | null;
  audit_event_ids: string[];
};

export type V10ExternalEvidenceSubmissionReadModel = V10SharedReadModelFields & {
  submission_id: string;
  evidence_request_id: string;
  contract_id: string;
  external_link_id: string | null;
  submitter_name_state: "provided" | "not_provided";
  submitter_email_state: "provided" | "not_provided" | "redacted";
  submitted_at: string | null;
  file_count: number;
  file_type_summary: string;
  note_state: "provided" | "not_provided" | "redacted";
  upload_status: string;
  review_status: string;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  audit_event_ids: string[];
};

export type V10AuditEventReadModel = V10SharedReadModelFields & {
  audit_event_id: string;
  actor_user_id: string | null;
  actor_type: "user" | "system" | "external";
  action: string;
  target_type: V10SourceObjectType;
  target_id: string;
  contract_id: string | null;
  outcome: string;
  before_state_hash: string | null;
  after_state_hash: string | null;
  safe_metadata: Record<string, string | number | boolean | null>;
  diagnostic_id: string | null;
};

export type V10JobRunVisibilityReadModel = V10SharedReadModelFields & {
  job_id: string;
  job_class: V10JobClass;
  status: V10JobStatus;
  cancellation_state: V10CancellationState;
  source_type: V10SourceObjectType;
  source_id: string;
  contract_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  retryable_count: number;
  diagnostic_id: string | null;
  failure_category: string | null;
  user_visible_detail: string;
  retry_action: string | null;
};

export type V10ReportRunVisibilityReadModel = V10SharedReadModelFields & {
  report_run_id: string;
  report_family: V10ReportFamily;
  source_filters_safe: Record<string, string | number | boolean | null>;
  initiated_by_user_id: string | null;
  schedule_id: string | null;
  status: V10JobStatus;
  started_at: string | null;
  completed_at: string | null;
  selected_row_count: number | null;
  generated_row_count: number | null;
  artifact_url: string | null;
  delivery_destination_state: string;
  failure_category: string | null;
  diagnostic_id: string | null;
  retry_action: string | null;
};

export type V10CommandSearchIndexReadModel = V10SharedReadModelFields & {
  record_type: string;
  record_id: string;
  label: string;
  description_safe: string;
  href: string;
  rank_terms_safe: string[];
  required_role_minimum: V10Role;
  workspace_mode_minimum: V10WorkspaceMode;
  module_key: string | null;
  plan_minimum: V10Plan;
  updated_at: string;
};

export type V10AdvancedAssuranceLinkedRecordReadModel = V10SharedReadModelFields & {
  record_type: string;
  record_id: string;
  workspace_mode_minimum: Exclude<V10WorkspaceMode, "core">;
  status: string;
  owner_user_id: string | null;
  source_contract_ids: string[];
  generated_work_item_ids: string[];
  command_search_record_id: string | null;
  audit_event_ids: string[];
};

export type V10ReadModel =
  | V10ActivationStateReadModel
  | V10WorkItemReadModel
  | V10ContractHealthSnapshotReadModel
  | V10ContractActivityEventReadModel
  | V10FieldProvenanceRecordReadModel
  | V10RenewalPostureSnapshotReadModel
  | V10EvidenceRequestStatusReadModel
  | V10ObligationRecordReadModel
  | V10ApprovalRecordReadModel
  | V10ExceptionRecordReadModel
  | V10NotificationDeliveryReadModel
  | V10RenewalCheckpointRecordReadModel
  | V10ExternalEvidenceSubmissionReadModel
  | V10AuditEventReadModel
  | V10JobRunVisibilityReadModel
  | V10ReportRunVisibilityReadModel
  | V10CommandSearchIndexReadModel
  | V10AdvancedAssuranceLinkedRecordReadModel;

export type V10ReadModelByKey = {
  activation_state: V10ActivationStateReadModel;
  work_items: V10WorkItemReadModel;
  contract_health_snapshots: V10ContractHealthSnapshotReadModel;
  contract_activity_events: V10ContractActivityEventReadModel;
  field_provenance_records: V10FieldProvenanceRecordReadModel;
  renewal_posture_snapshots: V10RenewalPostureSnapshotReadModel;
  evidence_request_statuses: V10EvidenceRequestStatusReadModel;
  obligation_records: V10ObligationRecordReadModel;
  approval_records: V10ApprovalRecordReadModel;
  exception_records: V10ExceptionRecordReadModel;
  notification_deliveries: V10NotificationDeliveryReadModel;
  renewal_checkpoint_records: V10RenewalCheckpointRecordReadModel;
  external_evidence_submissions: V10ExternalEvidenceSubmissionReadModel;
  audit_events: V10AuditEventReadModel;
  job_run_visibility: V10JobRunVisibilityReadModel;
  report_run_visibility: V10ReportRunVisibilityReadModel;
  command_search_index: V10CommandSearchIndexReadModel;
  advanced_assurance_linked_records: V10AdvancedAssuranceLinkedRecordReadModel;
};

export type V10ReadModelQueryContext = {
  organizationId: string;
  role: V10Role;
  workspaceMode?: V10WorkspaceMode;
  plan?: V10Plan;
  enabledModuleKeys?: readonly string[];
};

export type V10ReadModelQueryOptions = {
  sourceId?: string;
  contractId?: string;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
};

export type V10ReadModelQueryMetadata = {
  modelKey: keyof V10ReadModelByKey;
  tableName: `v10_${string}`;
  rowCount: number;
  freshnessState: "fresh" | "stale" | "partial" | "failed" | "missing";
  staleReason: string | null;
  diagnosticId: string | null;
  recoveryDestination: string;
  sourceLineageRequired: boolean;
};

export type V10ReadModelQueryResult<K extends keyof V10ReadModelByKey> = {
  rows: V10ReadModelByKey[K][];
  metadata: V10ReadModelQueryMetadata & { modelKey: K };
  error: string | null;
};

type V10ReadModelQueryBuilder = PromiseLike<{ data: Row[] | null; error: { message: string } | null }> & {
  select(columns?: string): V10ReadModelQueryBuilder;
  eq(column: string, value: unknown): V10ReadModelQueryBuilder;
  in?(column: string, values: readonly unknown[]): V10ReadModelQueryBuilder;
  order?(column: string, options?: { ascending?: boolean }): V10ReadModelQueryBuilder;
  limit?(count: number): V10ReadModelQueryBuilder;
};

type V10ReadModelClient = {
  from(table: `v10_${string}`): V10ReadModelQueryBuilder;
};

type Row = Record<string, unknown>;

export const V10_REQUIRED_READ_MODEL_KEYS = [
  "activation_state",
  "work_items",
  "contract_health_snapshots",
  "contract_activity_events",
  "field_provenance_records",
  "renewal_posture_snapshots",
  "evidence_request_statuses",
  "obligation_records",
  "approval_records",
  "exception_records",
  "notification_deliveries",
  "renewal_checkpoint_records",
  "external_evidence_submissions",
  "audit_events",
  "job_run_visibility",
  "report_run_visibility",
  "command_search_index",
  "advanced_assurance_linked_records",
] as const;

export type V10ReadModelRuntimeContract = {
  key: (typeof V10_REQUIRED_READ_MODEL_KEYS)[number];
  tableName: `v10_${string}`;
  sourceArtifact: string;
  refreshArtifact: string;
  migrationArtifact: string;
  testArtifacts: readonly string[];
  freshnessWindowMinutes: number;
  supportsIncrementalRefresh: boolean;
  supportsRepairRefresh: boolean;
  supportsScopedContractRefresh: boolean;
  retentionPolicy: "source_retained" | "artifact_expiring" | "release_evidence" | "refresh_job_retained";
};

function buildV10ReadModelRuntimeContract(
  key: (typeof V10_REQUIRED_READ_MODEL_KEYS)[number],
  input: Partial<Omit<V10ReadModelRuntimeContract, "key" | "tableName">> = {}
): V10ReadModelRuntimeContract {
  return {
    key,
    tableName: `v10_${key}`,
    sourceArtifact: input.sourceArtifact ?? "src/lib/v10-read-models.ts",
    refreshArtifact: input.refreshArtifact ?? "src/lib/v10-read-model-refresh.ts",
    migrationArtifact: input.migrationArtifact ?? "supabase/migrations/057_v10_runtime_contracts.sql",
    testArtifacts: input.testArtifacts ?? [
      "src/lib/v10-data-contracts.v10.test.ts",
      "src/lib/v10-read-model-refresh.v10.test.ts",
    ],
    freshnessWindowMinutes: input.freshnessWindowMinutes ?? 5,
    supportsIncrementalRefresh: input.supportsIncrementalRefresh ?? true,
    supportsRepairRefresh: input.supportsRepairRefresh ?? true,
    supportsScopedContractRefresh: input.supportsScopedContractRefresh ?? true,
    retentionPolicy: input.retentionPolicy ?? "source_retained",
  };
}

export const V10_READ_MODEL_RUNTIME_CONTRACTS: readonly V10ReadModelRuntimeContract[] = V10_REQUIRED_READ_MODEL_KEYS.map(
  (key) =>
    buildV10ReadModelRuntimeContract(key, {
      freshnessWindowMinutes:
        key === "job_run_visibility" || key === "report_run_visibility"
            ? 2
            : 5,
      supportsScopedContractRefresh: ![
        "external_evidence_submissions",
        "job_run_visibility",
        "report_run_visibility",
        "command_search_index",
        "advanced_assurance_linked_records",
      ].includes(key),
      retentionPolicy:
        key === "external_evidence_submissions"
          ? "artifact_expiring"
          : key === "audit_events"
            ? "release_evidence"
            : "source_retained",
    })
);

export function getV10ReadModelTableName<K extends keyof V10ReadModelByKey>(key: K): `v10_${K}` {
  return `v10_${key}` as const;
}

function buildV10ReadModelSelectColumns<K extends keyof V10ReadModelByKey>(key: K): string {
  const extra = V10_READ_MODEL_FIELDS[key] as readonly string[];
  return [...new Set([...V10_SHARED_READ_MODEL_FIELDS, ...extra])].join(",");
}

function applyV10ReadModelScopedFilters(
  query: V10ReadModelQueryBuilder,
  options: V10ReadModelQueryOptions
): V10ReadModelQueryBuilder {
  let next = query;
  if (options.sourceId) next = next.eq("source_id", options.sourceId);
  if (options.contractId) next = next.eq("contract_id", options.contractId);
  if (options.orderBy && typeof next.order === "function") {
    next = next.order(options.orderBy, { ascending: options.ascending ?? false });
  }
  if (options.limit && typeof next.limit === "function") next = next.limit(options.limit);
  return next;
}

export async function queryV10ReadModel<K extends keyof V10ReadModelByKey>(
  client: V10ReadModelClient,
  key: K,
  context: V10ReadModelQueryContext,
  options: V10ReadModelQueryOptions = {}
): Promise<V10ReadModelQueryResult<K>> {
  const tableName = getV10ReadModelTableName(key);
  const baseQuery = client.from(tableName).select(buildV10ReadModelSelectColumns(key));
  const visibleQuery =
    key === "command_search_index"
      ? applyV10CommandSearchVisibility(baseQuery, {
          organizationId: context.organizationId,
          role: context.role,
          workspaceMode: context.workspaceMode ?? "core",
          plan: context.plan ?? "core",
        })
      : applyV10ReadModelVisibility(baseQuery, {
          organizationId: context.organizationId,
          role: context.role,
          workspaceMode: context.workspaceMode ?? "core",
        });
  const scopedQuery = applyV10ReadModelScopedFilters(visibleQuery as V10ReadModelQueryBuilder, options);
  const { data, error } = await scopedQuery;
  const rows = (data ?? []) as V10ReadModelByKey[K][];
  const diagnosticId = error ? `v10_read_model_query_failed:${String(key)}` : null;
  return {
    rows,
    metadata: {
      modelKey: key,
      tableName,
      rowCount: rows.length,
      freshnessState: error ? "failed" : rows.length === 0 ? "missing" : "fresh",
      staleReason: error ? error.message : rows.length === 0 ? "no_visible_rows" : null,
      diagnosticId,
      recoveryDestination: `/settings/health?model=${String(key)}`,
      sourceLineageRequired: true,
    },
    error: error?.message ?? null,
  };
}

export function getV10VisibilityState(input: {
  deletedAt?: string | null;
  archivedAt?: string | null;
  hiddenByMode?: boolean;
  hiddenByRole?: boolean;
  hiddenByPlan?: boolean;
  hiddenByModule?: boolean;
}): V10VisibilityState {
  if (input.deletedAt) return "deleted";
  if (input.archivedAt) return "archived";
  if (input.hiddenByMode) return "hidden_by_mode";
  if (input.hiddenByRole) return "hidden_by_role";
  if (input.hiddenByPlan) return "hidden_by_plan";
  if (input.hiddenByModule) return "hidden_by_module";
  return "visible";
}

export function validateV10ReadModelRuntimeContracts(
  rows: readonly V10ReadModelRuntimeContract[] = V10_READ_MODEL_RUNTIME_CONTRACTS
): string[] {
  const failures: string[] = [];
  const byKey = new Map(rows.map((row) => [row.key, row]));
  if (byKey.size !== rows.length) failures.push("read_model_runtime_contract_duplicate");
  for (const key of V10_REQUIRED_READ_MODEL_KEYS) {
    const row = byKey.get(key);
    if (!row) {
      failures.push(`read_model_runtime_contract_missing:${key}`);
      continue;
    }
    if (row.tableName !== `v10_${key}`) failures.push(`${key}:table_name_mismatch`);
    if (!row.sourceArtifact.startsWith("src/")) failures.push(`${key}:source_artifact_required`);
    if (!row.refreshArtifact.includes("v10-read-model-refresh")) failures.push(`${key}:refresh_artifact_required`);
    if (!row.migrationArtifact.startsWith("supabase/migrations/")) failures.push(`${key}:migration_artifact_required`);
    if (row.testArtifacts.length === 0) failures.push(`${key}:test_artifact_required`);
    if (!Number.isFinite(row.freshnessWindowMinutes) || row.freshnessWindowMinutes <= 0) {
      failures.push(`${key}:freshness_window_invalid`);
    }
    if (!row.supportsRepairRefresh) failures.push(`${key}:repair_refresh_required`);
    if (row.retentionPolicy === "artifact_expiring" && row.supportsScopedContractRefresh) {
      failures.push(`${key}:artifact_expiring_must_not_scope_by_contract_only`);
    }
  }
  return failures;
}

export function assertV10SharedReadModelFields(row: Partial<V10SharedReadModelFields>): boolean {
  return Boolean(
    row.id &&
      row.organization_id &&
      row.workspace_mode &&
      row.required_role_minimum &&
      row.feature_family &&
      row.source_table &&
      row.source_id &&
      row.created_at &&
      row.updated_at &&
      row.visibility_state
  );
}

export type V10SourceLinkColumnCompatibility = {
  readModelKey: (typeof V10_REQUIRED_READ_MODEL_KEYS)[number];
  sourceObjectType: V10SourceObjectType;
  sourceTable: string;
  canonicalSourceIdColumn: "source_id";
  linkedSourceIdColumn: "linked_source_id" | null;
  linkedSourceIdRequired: boolean;
};

export const V10_SOURCE_LINK_COLUMN_COMPATIBILITY: readonly V10SourceLinkColumnCompatibility[] = [
  {
    readModelKey: "exception_records",
    sourceObjectType: "exception",
    sourceTable: "v10_exception_records",
    canonicalSourceIdColumn: "source_id",
    linkedSourceIdColumn: "linked_source_id",
    linkedSourceIdRequired: false,
  },
  {
    readModelKey: "notification_deliveries",
    sourceObjectType: "notification_delivery",
    sourceTable: "v10_notification_deliveries",
    canonicalSourceIdColumn: "source_id",
    linkedSourceIdColumn: "linked_source_id",
    linkedSourceIdRequired: true,
  },
] as const;

export function validateV10SourceLinkColumnCompatibility(
  rows: readonly V10SourceLinkColumnCompatibility[] = V10_SOURCE_LINK_COLUMN_COMPATIBILITY
): string[] {
  const failures: string[] = [];
  for (const row of rows) {
    if (!V10_REQUIRED_READ_MODEL_KEYS.includes(row.readModelKey)) failures.push(`unknown_read_model:${row.readModelKey}`);
    if (row.canonicalSourceIdColumn !== "source_id") failures.push(`canonical_source_id_mismatch:${row.readModelKey}`);
    if (row.linkedSourceIdRequired && row.linkedSourceIdColumn !== "linked_source_id") {
      failures.push(`required_linked_source_id_missing:${row.readModelKey}`);
    }
  }
  return failures;
}

export function validateV10ReadModelLineage(row: Partial<V10SharedReadModelFields>): string[] {
  const failures: string[] = [];
  if (!row.organization_id) failures.push("organization_id_missing");
  if (!row.source_table) failures.push("source_table_missing");
  if (!row.source_id) failures.push("source_id_missing");
  if (!row.created_at) failures.push("created_at_missing");
  if (!row.updated_at) failures.push("updated_at_missing");
  if (!row.visibility_state) failures.push("visibility_state_missing");
  if (row.deleted_at && row.visibility_state !== "deleted") failures.push("deleted_visibility_mismatch");
  if (row.archived_at && row.visibility_state !== "archived") failures.push("archived_visibility_mismatch");
  return failures;
}
