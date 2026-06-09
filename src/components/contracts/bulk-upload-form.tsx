"use client";

import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { bulkCreateContractsFromFiles } from "@/actions/contracts";
import { ChipPair } from "@/components/ui/chip-pair";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { MetaChip } from "@/components/ui/meta-chip";
import { RatioChip } from "@/components/ui/ratio-chip";
import { CreationPipeline } from "@/components/contracts/creation-pipeline";
import { Dropzone } from "@/components/contracts/dropzone";
import { SelectedFileList } from "@/components/contracts/selected-file-list";
import { UploadTrustNote } from "@/components/contracts/upload-trust-note";
import { CONTRACT_FILE_MAX_BYTES, CONTRACT_FILE_MAX_MB_LABEL } from "@/lib/constants/upload-limits";
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
  "Track renewals and tasks",
] as const;

const FILE_STEPS = [
  "Validate files",
  "Create records",
  "Confirm suggested details",
  "Assign owners and dates",
  "Track renewals and tasks",
] as const;

const MAX_CSV_BYTES = 2_000_000;
const MAX_FILE_BYTES = CONTRACT_FILE_MAX_BYTES;
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
  const groupColumns = (key: string) =>
    CSV_COLUMNS.filter((column) => column.group === key);
  return (
    <div>
      <p className="ui-caps-2 text-[10.5px] text-[var(--text-secondary)]">Spreadsheet columns</p>
      {/* Required gets its own column so the two server-required headers read as
          the priority; Optional + Source share the second column as the "nice
          to have" group (§10.18). Compressed into one bordered strip so the
          chips read as a single reference block rather than loose scatter. */}
      <div className="mt-2 grid gap-x-6 gap-y-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,var(--surface-raised))] p-3 lg:grid-cols-2">
        <div>
          <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Required</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {groupColumns("required").map((column) => (
              <ColumnChip
                key={column.header}
                label={column.label}
                header={column.header}
                required={column.required}
              />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {COLUMN_GROUPS.filter((group) => group.key !== "required").map((group) => (
            <div key={group.key}>
              <p className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">{group.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {groupColumns(group.key).map((column) => (
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
      </div>
      {/* Honesty strip (§10.13): unknown columns are dropped and imported values
          are unreviewed until the user reviews them — stated as structured
          chips rather than a prose footnote. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ChipPair primary="Unknown columns" secondary="ignored" />
        <ChipPair primary="Imported values" secondary="unreviewed" />
      </div>
    </div>
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
        rejected.push(`${file.name} is over ${CONTRACT_FILE_MAX_MB_LABEL}`);
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
  const showPrimary = canSubmit || isPending;

  const sourceFileBytes = sourceFiles.reduce((sum, file) => sum + file.size, 0);
  const submitLabel = activePath === "csv" ? "Import contracts" : "Import signed files";
  // Structured readiness (§10.7): a tone dot + caps state, not a prose hint.
  const readinessTone = ready ? "var(--success-ink)" : "var(--border-strong)";
  const readinessLabel = ready
    ? "Ready to import"
    : activePath === "csv"
      ? csvFile
        ? "Fix CSV headers"
        : "Choose CSV file"
      : "Choose signed files";

  return (
    <form className="ui-card-raised overflow-hidden p-0" onSubmit={handleSubmit}>
      {/* Segmented source switch — fills the header width with a clear active /
          inactive contrast; the selected tab carries an accent ring so it reads
          as firmly attached to the panel below it. */}
      <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3">
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] p-1"
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
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  selected
                    ? "bg-[var(--surface-raised)] font-semibold text-[var(--accent-strong)] shadow-[var(--shadow-1)] ring-1 ring-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-subtle))]"
                    : "font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                          Confirm suggested details
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
            {/* CSV file header row — the template download sits inline with the
                field label so the example is reachable before browsing. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="ui-label">CSV file</p>
                <KeyValueChip label="Max" value="2 MB" />
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="ui-btn-secondary inline-flex max-w-max items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold"
              >
                <Download className="h-3 w-3" strokeWidth={2} aria-hidden />
                Download CSV template
              </button>
            </div>
            <div className="mt-2">
              <Dropzone
                inputRef={csvInputRef}
                inputId="csv-file-input"
                name="csvFile"
                accept=".csv,text/csv"
                ariaLabel="CSV file"
                primaryText={
                  <>
                    <span className="text-[var(--accent-strong)]">Choose CSV tracker</span> or drag and drop
                  </>
                }
                formats={["CSV"]}
                hint="up to 2 MB"
                note="title + counterparty required"
                disabled={disabled || isPending}
                onFiles={handleCsvFiles}
              />
            </div>

            {csvFile ? (
              <div className="mt-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2.5">
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
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  </button>
                </div>
                {/* Post-select stat strip — a quick read of rows + header health
                    as structured chips. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2">
                  {csvCheck == null ? (
                    <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">Checking file…</span>
                  ) : (
                    <>
                      <KeyValueChip
                        label="Rows"
                        value={csvCheck.rows}
                        tone={csvIssue ? "warning" : "success"}
                      />
                      <KeyValueChip
                        label="Required"
                        value={csvCheck.missingHeaders.length === 0 ? "found" : "missing"}
                        tone={csvCheck.missingHeaders.length === 0 ? "success" : "warning"}
                      />
                      {csvCheck.ignoredHeaders.length > 0 ? (
                        <KeyValueChip label="Unknown" value={csvCheck.ignoredHeaders.length} />
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
              <div className="mt-2 ui-alert-warning text-[12px]" role="status">
                <p className="ui-caps-2 text-[10px]">Needs correction</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {csvCheck.missingHeaders.map((header) => (
                    <MetaChip key={header} tone="warning">
                      Missing {header}
                    </MetaChip>
                  ))}
                </div>
              </div>
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
          <CreationPipeline
            heading="What happens next"
            steps={CSV_STEPS.map((label) => ({ label }))}
            layout="compact"
          />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="import-panel-files"
          aria-labelledby="import-tab-files"
          className="space-y-5 px-5 py-4"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="ui-label">Signed PDF or DOCX files</p>
              <KeyValueChip label="Max" value={`${CONTRACT_FILE_MAX_MB_LABEL} each`} />
            </div>
            <div className="mt-2">
              <Dropzone
                inputRef={signedFilesInputRef}
                inputId="signed-files-input"
                name="files"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                ariaLabel="Signed PDF or DOCX files"
                primaryText={
                  <>
                    <span className="text-[var(--accent-strong)]">Choose signed files</span> or drag and drop
                  </>
                }
                formats={["PDF", "DOCX"]}
                hint={`up to 12 files, ${CONTRACT_FILE_MAX_MB_LABEL} each`}
                note="one file per contract"
                disabled={disabled || isPending}
                onFiles={handleSignedFiles}
              />
            </div>

            {/* What each file becomes — the trust model as structured chips
                (§10.7), so the lower half of the tab carries signal even before
                files are chosen. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <ChipPair primary="One file" secondary="one contract" />
              <ChipPair primary="Details" secondary="suggested" />
              <ChipPair primary="Confirmation" secondary="required" />
            </div>
            <div className="mt-3">
              <UploadTrustNote />
            </div>

            {sourceFiles.length > 0 ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <RatioChip numerator={sourceFiles.length} denominator={MAX_FILES} suffix="files" />
                  <KeyValueChip label="Total" value={formatFileSize(sourceFileBytes)} />
                </div>
                <SelectedFileList
                  files={sourceFiles}
                  onRemove={removeSignedFile}
                  disabled={disabled || isPending}
                />
              </div>
            ) : null}

            {fileRejections.length > 0 ? (
              <div className="ui-alert-warning mt-2 text-[12px]" role="status">
                <p className="ui-caps-2 text-[10px]">Needs correction</p>
                <div className="mt-1 space-y-0.5">
                  {fileRejections.map((rejection) => (
                    <p key={rejection}>{rejection}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <CreationPipeline
            heading="What happens next"
            steps={FILE_STEPS.map((label) => ({ label }))}
            layout="compact"
          />
        </div>
      )}

      {/* Bottom action bar: structured readiness on the left, submit cluster on
          the right. Both the readiness label and the button keep a stable width
          so they don't jump between states / when the spinner replaces the label. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,transparent)] px-5 py-3">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-1.5 w-1.5 rounded-full"
            style={{
              background: readinessTone,
              boxShadow: `0 0 0 3px color-mix(in oklab, ${
                ready ? "var(--success-soft)" : "var(--surface-muted)"
              } 45%, transparent)`,
            }}
          />
          <span className="ui-caps-2 inline-block min-w-[9.5rem] text-[10px] text-[var(--text-secondary)]">
            {readinessLabel}
          </span>
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          className={
            showPrimary
              ? "ui-btn-primary inline-flex min-h-9 min-w-[10rem] items-center justify-center gap-2 rounded-full px-4 text-[12.5px] font-semibold"
              : "ui-btn-secondary inline-flex min-h-9 min-w-[10rem] cursor-not-allowed items-center justify-center gap-2 rounded-full px-4 text-[12.5px] font-semibold opacity-70"
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
