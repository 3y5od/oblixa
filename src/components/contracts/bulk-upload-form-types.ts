import { FileSpreadsheet, FileText } from "lucide-react";
import { CONTRACT_FILE_MAX_BYTES } from "@/lib/constants/upload-limits";

export interface BulkUploadFormProps {
  organizationId: string;
  disabled?: boolean;
  disabledReason?: string;
  initialTab?: ImportPath;
}

export type ImportPath = "csv" | "files";

export type ImportResult = {
  type: "success" | "error";
  text: string;
  jobId?: string | null;
};

export type ImportApiBody = {
  success?: boolean;
  jobId?: string | null;
  created?: number | null;
  error?: string | null;
  v10?: {
    user_visible_message?: string | null;
    changed_object_id?: string | null;
  } | null;
  details?: {
    v10?: {
      user_visible_message?: string | null;
      changed_object_id?: string | null;
    } | null;
  } | null;
};

export type CsvCheck = {
  rows: number;
  missingHeaders: string[];
  ignoredHeaders: string[];
  tooLarge: boolean;
  empty: boolean;
};

export const IMPORT_METHODS = [
  {
    key: "csv",
    label: "Tracker CSV",
    icon: FileSpreadsheet,
    description: "Bring rows from a contract tracker exported to CSV.",
  },
  {
    key: "files",
    label: "Signed contract files",
    icon: FileText,
    description: "Upload signed PDF or DOCX files, one contract per file.",
  },
] as const;

export const CSV_COLUMNS = [
  { label: "Contract name", header: "title", required: true, becomes: "Contract record title" },
  { label: "Counterparty", header: "counterparty", required: true, becomes: "Counterparty detail" },
  { label: "Owner email", header: "owner_email", required: false, becomes: "Owner detail, matched to a workspace member" },
  { label: "Contract type", header: "contract_type", required: false, becomes: "Contract type detail" },
  { label: "Region", header: "region", required: false, becomes: "Region detail" },
  { label: "Source system", header: "source_system", required: false, becomes: "Source system detail" },
  { label: "External reference", header: "external_reference_id", required: false, becomes: "External reference detail" },
] as const;

export const REQUIRED_HEADERS = CSV_COLUMNS.filter((column) => column.required).map(
  (column) => column.header
);
export const TEMPLATE_HEADERS = CSV_COLUMNS.map((column) => column.header);
export const KNOWN_HEADERS = new Set<string>(TEMPLATE_HEADERS);

export const CSV_STEPS = [
  "Validate rows",
  "Check duplicates",
  "Create contract records",
  "Review imported details",
  "Confirm owners and dates",
  "Track renewals and tasks",
] as const;

export const FILE_STEPS = [
  "Validate files",
  "Create records",
  "Confirm suggested details",
  "Confirm owners and dates",
  "Track renewals and tasks",
] as const;

// Enforced import limits. These are the single source for the import UI's
// disclosed limits and MUST stay in sync with the server: MAX_CSV_BYTES mirrors
// `MAX_IMPORT_BODY_CHARS` in src/lib/import-jobs.ts, and MAX_FILES is the
// per-import batch ceiling. Both are recorded in the release-state limits table
// (Import CSV size = 2 MB, Upload batch size = 12 files) as intentional stricter
// ceilings; raise the code constant and that table together if loosened.
export const MAX_CSV_BYTES = 2_000_000;
export const MAX_FILE_BYTES = CONTRACT_FILE_MAX_BYTES;
export const MAX_FILES = 12;
export const SIGNED_FILES_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
