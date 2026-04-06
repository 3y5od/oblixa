export type OrgRole = "admin" | "editor" | "viewer";

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
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  owner?: Profile;
  contract_files?: ContractFile[];
  extracted_fields?: ExtractedField[];
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
