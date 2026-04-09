export type OrgRole =
  | "admin"
  | "editor"
  | "viewer"
  | "ops_manager"
  | "legal_reviewer"
  | "finance_reviewer"
  | "manager";

export type ContractStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "expired"
  | "terminated";

export type FieldStatus = "pending" | "approved" | "rejected" | "edited";
export type FieldSource = "ai" | "human";

export interface Organization {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  /** Synced from Stripe webhooks; used with subscription id for entitlement checks */
  stripe_subscription_status?: string | null;
  stripe_subscription_current_period_end?: string | null;
  created_at: string;
  updated_at: string;
}

export type ExtractionJobStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed";

export type ContractTaskStatus = "open" | "in_progress" | "blocked" | "done";
export type ContractTaskPriority = "low" | "medium" | "high";

export interface ContractExtractionJob {
  id: string;
  contract_id: string;
  organization_id: string;
  status: ExtractionJobStatus;
  attempt_count: number;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractTask {
  id: string;
  contract_id: string;
  organization_id: string;
  created_by: string | null;
  assignee_id: string | null;
  title: string;
  details: string | null;
  status: ContractTaskStatus;
  priority: ContractTaskPriority;
  created_via?: "manual" | "rule" | "clarification" | "integration";
  linked_field_id?: string | null;
  linked_reminder_id?: string | null;
  linked_obligation_id?: string | null;
  linked_checkpoint_id?: string | null;
  team_key?: string | null;
  parent_task_id?: string | null;
  blocked_by_task_id?: string | null;
  blocked_reason?: string | null;
  recurrence_rule?: string | null;
  recurrence_interval_days?: number | null;
  recurrence_anchor_date?: string | null;
  next_run_date?: string | null;
  sla_due_at?: string | null;
  escalation_at?: string | null;
  last_auto_transition_at?: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractTaskEvent {
  id: string;
  organization_id: string;
  contract_id: string;
  task_id: string;
  event_type:
    | "created"
    | "status_changed"
    | "reassigned"
    | "deleted"
    | "clarification_requested";
  actor_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ContractNote {
  id: string;
  contract_id: string;
  organization_id: string;
  author_id: string | null;
  note: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type ContractObligationStatus = "open" | "in_progress" | "done" | "waived";

export interface ContractObligation {
  id: string;
  contract_id: string;
  organization_id: string;
  created_by: string | null;
  owner_id: string | null;
  title: string;
  details: string | null;
  obligation_type: string;
  cadence: string | null;
  recurrence_type?: "none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom_days";
  recurrence_interval_days?: number | null;
  next_due_date?: string | null;
  escalation_due_at?: string | null;
  escalation_status?: "none" | "pending" | "sent" | "acked";
  due_date: string | null;
  status: ContractObligationStatus;
  evidence_notes: string | null;
  evidence_file_path?: string | null;
  evidence_url?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RenewalCheckpointStatus = "pending" | "completed" | "skipped";

export interface ContractRenewalCheckpoint {
  id: string;
  contract_id: string;
  organization_id: string;
  task_key: string;
  label: string;
  offset_days: number;
  due_date: string;
  status: RenewalCheckpointStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  onboarding_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  profiles?: Profile;
}

export interface Contract {
  id: string;
  organization_id: string;
  title: string;
  counterparty: string | null;
  contract_type: string | null;
  /** Full extracted plain text from files; used for keyword search */
  search_document?: string | null;
  status: ContractStatus;
  intake_status?:
    | "awaiting_review"
    | "in_clarification"
    | "active"
    | "at_risk"
    | "renewal_prep"
    | "notice_decision"
    | "archived";
  health_status?: "healthy" | "watch" | "at_risk" | "unknown";
  required_next_step?: string | null;
  operationally_active_at?: string | null;
  received_at?: string;
  reviewed_at?: string | null;
  owner_assigned_at?: string;
  source_system?: string | null;
  external_reference_id?: string | null;
  region?: string | null;
  annual_value?: number | null;
  crm_sync_status?: "never" | "ok" | "error";
  crm_last_synced_at?: string | null;
  secondary_owner_id?: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  owner?: Profile;
  contract_files?: ContractFile[];
  extracted_fields?: ExtractedField[];
}

export interface ContractImportJob {
  id: string;
  organization_id: string;
  created_by: string | null;
  source: string;
  status: "processing" | "completed" | "failed";
  total_rows: number;
  valid_rows: number;
  inserted_rows: number;
  error_rows: number;
  created_at: string;
  updated_at: string;
}

export interface ContractImportJobRow {
  id: string;
  job_id: string;
  organization_id: string;
  row_index: number;
  title: string | null;
  owner_email: string | null;
  status: "valid" | "inserted" | "error";
  error_message: string | null;
  contract_id: string | null;
  created_at: string;
}

export interface CalendarFeed {
  id: string;
  organization_id: string;
  user_id: string;
  token: string;
  active: boolean;
  created_at: string;
  last_accessed_at: string | null;
}

export interface ContractWatchlist {
  id: string;
  contract_id: string;
  organization_id: string;
  user_id: string;
  team_key: string | null;
  note: string | null;
  created_at: string;
}

export interface IntegrationConnection {
  id: string;
  organization_id: string;
  provider: "google_calendar" | "outlook_calendar" | "slack" | "email" | "crm";
  status: "not_connected" | "connected" | "error";
  config_json: Record<string, unknown>;
  last_synced_at: string | null;
  last_error: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  connected_account?: string | null;
  oauth_connected_at?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldTemplate {
  id: string;
  organization_id: string;
  contract_type: string | null;
  field_name: string;
  default_value: string | null;
  required: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ReminderTemplate {
  id: string;
  organization_id: string;
  contract_type: string | null;
  field_name: string;
  offset_days: number;
  reminder_type: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  organization_id: string;
  contract_type: string | null;
  team_key: string | null;
  title: string;
  details: string | null;
  due_offset_days: number;
  priority: ContractTaskPriority;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface OrganizationWorkflowSettings {
  id: string;
  organization_id: string;
  weekly_intake_lookback_days: number;
  renewal_horizon_days: number;
  stale_contract_days: number;
  stale_ownership_days: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalPolicy {
  id: string;
  organization_id: string;
  approval_type: ApprovalType;
  min_annual_value: number | null;
  contract_type: string | null;
  required_approver_id: string | null;
  sla_hours?: number;
  escalation_user_id?: string | null;
  delegation_allowed?: boolean;
  policy_category?: "standard" | "policy_exception" | "financial" | "operational";
  required: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationApiKey {
  id: string;
  organization_id: string;
  label: string;
  key_prefix: string;
  key_hash: string;
  scopes?: string[];
  active: boolean;
  expires_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractHandoffChecklist {
  id: string;
  contract_id: string;
  organization_id: string;
  from_owner_id: string | null;
  to_owner_id: string | null;
  checklist_note: string | null;
  status: "pending" | "completed";
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenewalPlaybookTemplate {
  id: string;
  organization_id: string;
  contract_type: string | null;
  task_key: string;
  label: string;
  offset_days: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractFile {
  id: string;
  contract_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface ExtractedField {
  id: string;
  contract_id: string;
  field_name: string;
  field_value: string | null;
  source_snippet: string | null;
  confidence: number | null;
  status: FieldStatus;
  source: FieldSource;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  contract_id: string;
  field_id: string | null;
  reminder_type: string;
  reminder_date: string;
  sent_at: string | null;
  recipient_id: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  organization_id: string;
  contract_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export type RenewalScenario =
  | "renew"
  | "renegotiate"
  | "terminate"
  | "replace"
  | "discontinue"
  | "temporary_extension"
  | "awaiting_decision";

export interface ContractRenewalScenario {
  id: string;
  contract_id: string;
  organization_id: string;
  scenario: RenewalScenario;
  decision_notes: string | null;
  blocker: string | null;
  workspace_status?: "not_started" | "in_progress" | "blocked" | "decision_pending" | "closed";
  owner_id?: string | null;
  target_decision_date?: string | null;
  decision_date?: string | null;
  escalation_date?: string | null;
  commercial_context?: string | null;
  scenario_confidence?: number | null;
  last_reviewed_at?: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ApprovalType =
  | "renewal_decision"
  | "notice_action"
  | "commercial_exception"
  | "ownership_handoff";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ContractApproval {
  id: string;
  contract_id: string;
  organization_id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  requested_by: string | null;
  approver_id: string | null;
  delegated_from_id?: string | null;
  delegated_to_id?: string | null;
  due_at?: string | null;
  escalated_at?: string | null;
  category?: "standard" | "policy_exception" | "financial" | "operational";
  exception_flag?: boolean;
  exception_reason?: string | null;
  notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractFieldComment {
  id: string;
  contract_id: string;
  organization_id: string;
  field_id: string | null;
  author_id: string | null;
  comment: string;
  mentions: string[];
  created_at: string;
}

export interface InternalNotification {
  id: string;
  organization_id: string;
  user_id: string;
  notification_type: "mention" | "task_assigned" | "approval_requested";
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const FIELD_NAMES = [
  "counterparty",
  "contract_type",
  "effective_date",
  "start_date",
  "end_date",
  "renewal_date",
  "notice_window",
  "term",
  "fee_reference",
  "payment_cadence",
  "auto_renewal",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];
