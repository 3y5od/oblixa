"use client";

import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { bulkCreateContractsFromFiles } from "@/actions/contracts";
import { formatFileSize } from "@/lib/format-file-size";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

interface BulkUploadFormProps {
  organizationId: string;
  disabled?: boolean;
  disabledReason?: string;
  initialTab?: ImportPath;
}

type ImportPath = "csv" | "files";

type ImportResult = {
  type: "success" | "error";
  text: string;
  jobId?: string | null;
};

type ImportApiBody = {
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

type CsvCheck = {
  rows: number;
  missingHeaders: string[];
  ignoredHeaders: string[];
  tooLarge: boolean;
  empty: boolean;
};

// Tabs name the two *sources* a user brings (a tracker exported to CSV, or
// signed agreements). The aria-label keeps the "Import source" identity that
// the UI test + assistive tech rely on. The CSV format stays honest on the
// field itself ("CSV file"), not the tab.
const IMPORT_METHODS = [
  { key: "csv", label: "Tracker spreadsheet", icon: FileSpreadsheet },
  { key: "files", label: "Signed contracts", icon: FileText },
] as const;

/**
 * The CSV importer (src/lib/import-jobs.ts CsvRow + runContractCsvImport,
 * lines ~338-352) persists exactly these seven columns. Date / value / status
 * / tag columns are NOT read by the importer, so advertising them here would
 * imply silent data loss — they are intentionally absent. The "Download
 * template" button is generated from this same list, so the displayed columns
 * and the template never drift.
 *
 * Canonical authoring headers (design-contract anchors in
 * contracts-import-release-state.test.ts): title, counterparty, owner_email,
 * contract_type, region, source_system, external_reference_id.
 */
const CSV_COLUMNS = [
  { label: "Contract title", header: "title", required: true, group: "required" },
  { label: "Counterparty", header: "counterparty", required: true, group: "required" },
  { label: "Owner email", header: "owner_email", required: false, group: "optional" },
  { label: "Contract type", header: "contract_type", required: false, group: "optional" },
  { label: "Region", header: "region", required: false, group: "optional" },
  { label: "Source system", header: "source_system", required: false, group: "source" },
  { label: "External reference ID", header: "external_reference_id", required: false, group: "source" },
] as const;

const COLUMN_GROUPS = [
  { key: "required", label: "Required" },
  { key: "optional", label: "Optional" },
  { key: "source", label: "Source" },
] as const;

const REQUIRED_HEADERS = CSV_COLUMNS.filter((column) => column.required).map(
  (column) => column.header
);
const TEMPLATE_HEADERS = CSV_COLUMNS.map((column) => column.header);
const KNOWN_HEADERS = new Set<string>(TEMPLATE_HEADERS);

// The post-submit pipeline, each label specific to the source and backed by
// real server behavior. CSV: validate rows, a duplicate check that REJECTS the
// file if it contains duplicate rows (api/import/contracts route), create the
// records, then review the imported pending-review contracts — CSV import
// creates no AI suggestions, it persists the seven typed columns. Signed
// files: validate, create one contract per file, then review the fields
// extraction suggests. "suggested" (not "extracted") follows the AI boundary.
const CSV_STEPS = [
  "Validate rows",
  "Check for duplicates",
  "Import records",
  "Review imported records",
  "Assign owners and dates",
  "Track renewals and work",
] as const;

const FILE_STEPS = [
  "Validate files",
  "Create records",
  "Review suggested fields",
  "Assign owners and dates",
  "Track renewals and work",
] as const;

const MAX_CSV_BYTES = 2_000_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 12;

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function importErrorMessage(body: ImportApiBody | null, fallback: string): string {
  return describeRecoverableMutationError(
    body?.details?.v10?.user_visible_message ??
      body?.v10?.user_visible_message ??
      body?.error ??
      fallback
  );
}

function isCsvFile(file: File): boolean {
  return (
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.name.toLowerCase().endsWith(".csv")
  );
}

function isPdfOrDocx(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx")
  );
}

// Lightweight client-side parse to guide the user *before* the round-trip:
// header presence (title + counterparty are server-required) and a row
// estimate. The server runs the authoritative validation; this only mirrors
// the contract the requirements section already shows.
async function inspectCsv(file: File): Promise<CsvCheck> {
  const tooLarge = file.size > MAX_CSV_BYTES;
  let text = "";
  try {
    text = await file.text();
  } catch {
    return { rows: 0, missingHeaders: [...REQUIRED_HEADERS], ignoredHeaders: [], tooLarge, empty: true };
  }
  // File.text() UTF-8-decodes, which already strips any leading BOM, so the
  // header cells below need no extra BOM handling.
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: 0, missingHeaders: [...REQUIRED_HEADERS], ignoredHeaders: [], tooLarge, empty: true };
  }
  const headers = lines[0]
    .split(",")
    .map((cell) => cell.trim().replace(/^"+|"+$/g, "").toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  const ignoredHeaders = headers.filter(
    (header) => header.length > 0 && !KNOWN_HEADERS.has(header)
  );
  return {
    rows: Math.max(0, lines.length - 1),
    missingHeaders,
    ignoredHeaders,
    tooLarge,
    empty: lines.length < 2,
  };
}

function downloadTemplate() {
  const example: Record<string, string> = {
    title: "Acme Master Services Agreement",
    counterparty: "Acme Corporation",
    owner_email: "owner@yourteam.com",
    contract_type: "MSA",
    region: "North America",
    source_system: "Salesforce",
    external_reference_id: "CW-00481",
  };
  const csv = `${TEMPLATE_HEADERS.join(",")}\n${TEMPLATE_HEADERS.map((header) => example[header] ?? "").join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "oblixa-contract-import-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ColumnChip({
  label,
  header,
  required,
}: {
  label: string;
  header: string;
  required: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] ${
        required
          ? "border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-primary)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)]"
      }`}
    >
      <span className={required ? "font-semibold" : "font-medium"}>{label}</span>
      <code className="font-mono text-[10.5px] text-[var(--text-tertiary)]">{header}</code>
    </span>
  );
}

function SpreadsheetColumns() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="ui-caps-2 text-[10.5px] text-[var(--text-secondary)]">Spreadsheet columns</p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="ui-btn-secondary inline-flex max-w-max items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold"
        >
          <Download className="h-3 w-3" strokeWidth={2} aria-hidden />
          Download CSV template
        </button>
      </div>
      <div className="mt-3 space-y-2.5">
        {COLUMN_GROUPS.map((group) => (
          <div
            key={group.key}
            className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3"
          >
            <span className="ui-caps-2 pt-1.5 text-[10px] text-[var(--text-tertiary)]">{group.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {CSV_COLUMNS.filter((column) => column.group === group.key).map((column) => (
                <ColumnChip
                  key={column.header}
                  label={column.label}
                  header={column.header}
                  required={column.required}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11.5px] text-[var(--text-tertiary)]">
        Only these columns import today; other columns in your file are ignored.
      </p>
    </div>
  );
}

function ImportSteps({ steps }: { steps: readonly string[] }) {
  return (
    <div>
      <p className="ui-caps-2 text-[10.5px] text-[var(--text-secondary)]">What happens next</p>
      <ol className="mt-2.5 grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex h-5 w-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] font-mono text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]"
            >
              {index + 1}
            </span>
            <span className="min-w-0 text-[12.5px] leading-snug text-[var(--text-secondary)]">
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Dropzone({
  inputRef,
  inputId,
  name,
  accept,
  multiple,
  ariaLabel,
  hint,
  disabled,
  onFiles,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  inputId: string;
  name: string;
  accept: string;
  multiple?: boolean;
  ariaLabel: string;
  hint: string;
  disabled?: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        if (disabled) return;
        const dropped = event.dataTransfer.files;
        if (inputRef.current) inputRef.current.files = dropped;
        onFiles(dropped);
      }}
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${
        disabled
          ? "cursor-not-allowed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,transparent)] opacity-60"
          : isOver
            ? "border-[color:color-mix(in_oklab,var(--accent)_60%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))]"
            : "border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_38%,var(--surface-raised))] hover:border-[color:color-mix(in_oklab,var(--accent)_38%,var(--border-strong))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))]"
      }`}
    >
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onFiles(event.currentTarget.files)}
        className="sr-only"
      />
      <span
        aria-hidden
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]"
      >
        <UploadCloud className="h-4 w-4" strokeWidth={1.85} />
      </span>
      <p className="text-[12.5px] font-medium text-[var(--text-secondary)]">
        <span className="text-[var(--accent-strong)]">Click to browse</span> or drag and drop
      </p>
      <p className="ui-caps-3 text-[10px] tabular-nums text-[var(--text-tertiary)]">{hint}</p>
    </label>
  );
}

function FileRow({
  icon: Icon,
  name,
  size,
  onRemove,
}: {
  icon: typeof FileText;
  name: string;
  size: number;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
        {name}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
        {formatFileSize(size)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] hover:text-[var(--text-primary)]"
      >
        <X className="h-3 w-3" strokeWidth={1.85} aria-hidden />
      </button>
    </li>
  );
}

export function BulkUploadForm({
  organizationId,
  disabled,
  disabledReason,
  initialTab,
}: BulkUploadFormProps) {
  const [isPending, startTransition] = useTransition();
  const [activePath, setActivePath] = useState<ImportPath>(initialTab ?? "csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvCheck, setCsvCheck] = useState<CsvCheck | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [fileRejections, setFileRejections] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const signedFilesInputRef = useRef<HTMLInputElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const router = useRouter();

  function selectTab(path: ImportPath) {
    setActivePath(path);
    setResult(null);
    // Reflect the tab in the URL (deep-linkable) without a navigation or
    // re-render, so the selected file state survives a tab switch. Guarded so
    // a non-browser / about:blank environment can never break the switch.
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", path === "files" ? "signed" : "csv");
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* URL / history unavailable — the tab still switches in state. */
      }
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = IMPORT_METHODS.findIndex((method) => method.key === activePath);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % IMPORT_METHODS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + IMPORT_METHODS.length) % IMPORT_METHODS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = IMPORT_METHODS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selectTab(IMPORT_METHODS[next].key);
    tabRefs.current[next]?.focus();
  }

  async function handleCsvFiles(list: FileList | null) {
    setResult(null);
    const file = list && list.length > 0 ? list[0] : null;
    // A missing or non-CSV file must fully reset the field. The dropzone
    // assigns the hidden input's files on drop *before* this validation, so
    // without clearing it the input would keep the rejected file while
    // csvFile/csvCheck still reflect a prior valid selection — leaving the
    // button enabled and posting the wrong bytes on submit.
    if (!file || !isCsvFile(file)) {
      clearCsv();
      if (file) {
        setCsvError("That file is not a CSV. Export your tracker to .csv and try again.");
      }
      return;
    }
    setCsvError(null);
    setCsvFile(file);
    setCsvCheck(null);
    setCsvCheck(await inspectCsv(file));
  }

  function clearCsv() {
    setCsvFile(null);
    setCsvCheck(null);
    setCsvError(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  function handleSignedFiles(list: FileList | null) {
    setResult(null);
    if (!list || list.length === 0) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      if (!isPdfOrDocx(file)) {
        rejected.push(`${file.name} is not a PDF or DOCX`);
      } else if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} is over 20 MB`);
      } else {
        accepted.push(file);
      }
    }
    if (sourceFiles.length + accepted.length > MAX_FILES) {
      rejected.push(`Up to ${MAX_FILES} files per import — extra files were skipped`);
    }
    // Functional updater (like removeSignedFile) so two back-to-back
    // selections can't drop the first batch by reading a stale closure.
    setSourceFiles((previous) => {
      const seen = new Set(previous.map((file) => `${file.name}:${file.size}`));
      const merged = [...previous];
      for (const file of accepted) {
        const key = `${file.name}:${file.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      }
      return merged.slice(0, MAX_FILES);
    });
    setFileRejections(rejected);
    if (signedFilesInputRef.current) signedFilesInputRef.current.value = "";
  }

  function removeSignedFile(index: number) {
    setSourceFiles((previous) => previous.filter((_, position) => position !== index));
    setFileRejections([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || isPending) return;
    const form = event.currentTarget;
    const fd = new FormData(form);
    fd.append("organizationId", organizationId);
    setResult(null);
    startTransition(async () => {
      if (activePath === "csv") {
        const formFile = fd.get("csvFile");
        const file = isFile(formFile) && formFile.size > 0 ? formFile : csvFile;
        if (!file || file.size === 0) {
          setResult({ type: "error", text: "Choose a CSV file to import." });
          return;
        }

        try {
          const csv = await file.text();
          const response = await fetch("/api/import/contracts", { // security:fetch-allowlist SEC-INT-005 same-origin CSV import endpoint; server-only safeFetch is not usable in this client form.
            method: "POST",
            headers: { "content-type": "text/csv; charset=utf-8" },
            body: csv,
          });
          const body = (await response.json().catch(() => null)) as ImportApiBody | null;
          if (!response.ok || !body?.success) {
            setResult({
              type: "error",
              text: importErrorMessage(body, `Import failed with status ${response.status}.`),
              jobId: body?.details?.v10?.changed_object_id ?? body?.v10?.changed_object_id ?? body?.jobId ?? null,
            });
            return;
          }

          const created = typeof body.created === "number" ? body.created : null;
          setResult({
            type: "success",
            text:
              created == null
                ? "CSV import job created. Review the imported contracts when processing completes."
                : `CSV import created ${created} contract${created === 1 ? "" : "s"} for review.`,
            jobId: body.jobId ?? body.v10?.changed_object_id ?? null,
          });
          form.reset();
          clearCsv();
          router.refresh();
        } catch {
          setResult({ type: "error", text: "Could not read or upload the CSV file. Try again." });
        }
        return;
      }

      const uploadData = new FormData();
      uploadData.append("organizationId", organizationId);
      for (const file of sourceFiles) {
        uploadData.append("files", file);
      }

      const res = await bulkCreateContractsFromFiles(sourceFiles.length > 0 ? uploadData : fd);
      if (res && "error" in res && res.error) {
        setResult({ type: "error", text: describeRecoverableMutationError(res.error) });
        return;
      }
      if (!(res && "success" in res && res.success)) {
        setResult({ type: "error", text: "No signed files were imported." });
        return;
      }

      const errPart = res.errors?.length
        ? ` Some files failed: ${res.errors.map(describeRecoverableMutationError).join("; ")}`
        : "";
      setResult({
        type: "success",
        text: `Created ${res.created} contract${res.created === 1 ? "" : "s"} from signed files.${errPart}`,
        jobId: res.job_id ?? null,
      });
      form.reset();
      setSourceFiles([]);
      setFileRejections([]);
      router.refresh();
    });
  }

  const csvIssue =
    csvCheck != null &&
    (csvCheck.missingHeaders.length > 0 || csvCheck.tooLarge || csvCheck.empty);
  const csvReady = csvFile != null && csvCheck != null && !csvIssue;
  const filesReady = sourceFiles.length > 0 && sourceFiles.length <= MAX_FILES;
  const ready = activePath === "csv" ? csvReady : filesReady;
  const canSubmit = !disabled && !isPending && ready;

  const sourceFileBytes = sourceFiles.reduce((sum, file) => sum + file.size, 0);
  const submitLabel = activePath === "csv" ? "Import contracts" : "Import signed contracts";
  const footerHint =
    activePath === "csv"
      ? csvFile
        ? csvReady
          ? "Ready to import."
          : "Fix the file to continue."
        : "Choose a tracker file to continue."
      : filesReady
        ? "Ready to import."
        : "Choose signed files to continue.";

  return (
    <form className="ui-card-raised overflow-hidden p-0" onSubmit={handleSubmit}>
      <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3.5">
        <div
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] p-1"
          role="tablist"
          aria-label="Import source"
          onKeyDown={onTabKeyDown}
        >
          {IMPORT_METHODS.map((item, index) => {
            const ItemIcon = item.icon;
            const selected = activePath === item.key;
            return (
              <button
                key={item.key}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`import-tab-${item.key}`}
                aria-selected={selected}
                aria-controls={`import-panel-${item.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(item.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  selected
                    ? "bg-[var(--surface-raised)] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <ItemIcon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {disabledReason && (
        <div className="border-b border-[var(--border-subtle)] px-5 py-3.5">
          <p className="ui-alert-warning text-sm" role="status">
            {disabledReason}
          </p>
        </div>
      )}

      {/* Always-mounted live region: it must pre-exist in the DOM so the async
          import result (success count or recoverable error) is announced when
          its text appears, rather than mounting together with the text. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={result ? "border-b border-[var(--border-subtle)] px-5 py-3.5" : ""}
      >
        {result && (
          <div
            className={`text-sm ${result.type === "error" ? "ui-alert-error" : "ui-alert-success"}`}
          >
            <div className="flex items-start gap-2">
              {result.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ) : null}
              <div className="min-w-0">
                <p>{result.text}</p>
                {result.jobId && (
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <a className="ui-link" href="#recent-imports">
                      Review import status
                    </a>
                    {result.type === "success" ? (
                      activePath === "files" ? (
                        <Link className="ui-link" href="/contracts/review">
                          Review suggested fields
                        </Link>
                      ) : (
                        <Link className="ui-link" href="/contracts">
                          Review imported contracts
                        </Link>
                      )
                    ) : null}
                    <Link className="ui-link" href={`/contracts/imports/${result.jobId}`}>
                      Open job details
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {activePath === "csv" ? (
        <div
          role="tabpanel"
          id="import-panel-csv"
          aria-labelledby="import-tab-csv"
          className="space-y-5 px-5 py-4"
        >
          <div>
            <p className="ui-label">CSV file</p>
            <div className="mt-2">
              <Dropzone
                inputRef={csvInputRef}
                inputId="csv-file-input"
                name="csvFile"
                accept=".csv,text/csv"
                ariaLabel="CSV file"
                hint="One .csv file, up to 2 MB"
                disabled={disabled || isPending}
                onFiles={handleCsvFiles}
              />
            </div>

            {csvFile ? (
              <div className="mt-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet
                    className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                    {csvFile.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                    {formatFileSize(csvFile.size)}
                  </span>
                  <button
                    type="button"
                    onClick={clearCsv}
                    aria-label={`Remove ${csvFile.name}`}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {csvCheck == null ? (
                    <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Checking file…</span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-flex h-1.5 w-1.5 rounded-full"
                          style={{
                            background: csvIssue ? "var(--warning-ink)" : "var(--success-ink)",
                            boxShadow: `0 0 0 3px color-mix(in oklab, ${
                              csvIssue ? "var(--warning-soft)" : "var(--success-soft)"
                            } 40%, transparent)`,
                          }}
                        />
                        <span className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                          {csvCheck.rows}
                        </span>
                        <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">
                          {csvCheck.rows === 1 ? "row" : "rows"}
                        </span>
                      </span>
                      {!csvIssue ? (
                        <span className="ui-caps-3 text-[10px] text-[var(--success-ink)]">Required columns found</span>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {csvError ? (
              <p className="ui-alert-warning mt-2 text-[12px]" role="status">
                {csvError}
              </p>
            ) : null}
            {csvCheck && csvCheck.missingHeaders.length > 0 ? (
              <p className="ui-alert-warning mt-2 text-[12px]" role="status">
                Add the required column{csvCheck.missingHeaders.length === 1 ? "" : "s"}:{" "}
                {csvCheck.missingHeaders.join(", ")}.
              </p>
            ) : null}
            {csvCheck?.tooLarge ? (
              <p className="ui-alert-warning mt-2 text-[12px]" role="status">
                This file is over 2 MB. Split it and import in batches.
              </p>
            ) : null}
            {csvCheck?.empty && !csvCheck.tooLarge && csvCheck.missingHeaders.length === 0 ? (
              <p className="ui-alert-warning mt-2 text-[12px]" role="status">
                This file has no contract rows under the header.
              </p>
            ) : null}
            {csvCheck && csvCheck.ignoredHeaders.length > 0 ? (
              <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
                These columns won&apos;t import:{" "}
                {csvCheck.ignoredHeaders.map((header, index) => (
                  <span key={header}>
                    {index > 0 ? ", " : ""}
                    <code className="font-mono text-[10.5px] text-[var(--text-secondary)]">
                      {header}
                    </code>
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          <SpreadsheetColumns />
          <ImportSteps steps={CSV_STEPS} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="import-panel-files"
          aria-labelledby="import-tab-files"
          className="space-y-5 px-5 py-4"
        >
          <div>
            <p className="ui-label">Signed PDF or DOCX files</p>
            <div className="mt-2">
              <Dropzone
                inputRef={signedFilesInputRef}
                inputId="signed-files-input"
                name="files"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                ariaLabel="Signed PDF or DOCX files"
                hint="PDF or DOCX, up to 12 files, 20 MB each"
                disabled={disabled || isPending}
                onFiles={handleSignedFiles}
              />
            </div>

            {sourceFiles.length > 0 ? (
              <>
                <ul className="mt-2.5 space-y-1.5">
                  {sourceFiles.map((file, index) => (
                    <FileRow
                      key={`${file.name}:${file.size}`}
                      icon={FileText}
                      name={file.name}
                      size={file.size}
                      onRemove={() => removeSignedFile(index)}
                    />
                  ))}
                </ul>
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[var(--text-tertiary)]">
                  <span className="font-mono tabular-nums">{sourceFiles.length}</span>
                  <span>of</span>
                  <span className="font-mono tabular-nums">{MAX_FILES}</span>
                  <span>files,</span>
                  <span className="font-mono tabular-nums">{formatFileSize(sourceFileBytes)}</span>
                </p>
              </>
            ) : null}

            {fileRejections.length > 0 ? (
              <div className="ui-alert-warning mt-2 text-[12px]" role="status">
                {fileRejections.map((rejection) => (
                  <p key={rejection}>{rejection}</p>
                ))}
              </div>
            ) : null}

            <p className="mt-2.5 text-[12px] leading-snug text-[var(--text-secondary)]">
              Each file becomes one contract with fields suggested for review.
            </p>
          </div>

          <ImportSteps steps={FILE_STEPS} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,transparent)] px-5 py-3">
        <p className="text-[12px] text-[var(--text-tertiary)]">{footerHint}</p>
        <button
          type="submit"
          disabled={!canSubmit}
          className={
            canSubmit || isPending
              ? "ui-btn-primary inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-[12.5px] font-semibold"
              : "inline-flex min-h-9 cursor-not-allowed items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,var(--surface-raised))] px-4 text-[12.5px] font-semibold text-[var(--text-tertiary)]"
          }
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {activePath === "csv" ? "Importing…" : "Uploading…"}
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
