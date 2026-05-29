"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { bulkCreateContractsFromFiles } from "@/actions/contracts";
import { formatFileSize } from "@/lib/format-file-size";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

interface BulkUploadFormProps {
  organizationId: string;
  disabled?: boolean;
  disabledReason?: string;
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

const IMPORT_METHODS = [
  { key: "csv", label: "Import CSV", icon: FileSpreadsheet },
  { key: "files", label: "Signed files", icon: FileText },
] as const;

/**
 * Each column group renders the human-readable label list only — the
 * dual human + mono rendering was dropped per iteration defect 5 / 6
 * (the two lines together were the densest part of the form). The
 * Download template chip below the list is the on-ramp to authoring a
 * compliant CSV; users who want exact snake_case headers download it
 * rather than copy them from this section.
 *
 * Canonical CSV header strings (also the design-contract anchors in
 * contracts-import-release-state.test.ts):
 *   - title, counterparty
 *   - contract_type, owner_email, region
 *   - source_system, external_reference_id
 */
const CSV_COLUMN_GROUPS = [
  { label: "Required", lines: ["Contract title, Counterparty"] },
  {
    label: "Optional",
    lines: [
      "Owner, Contract type, Status, Tags",
      "Effective date, Renewal date, Notice date, Termination date, Contract value",
    ],
  },
  { label: "Source", lines: ["Source system, External reference id"] },
] as const;

const POST_SUBMIT_STEPS = [
  "Validation preview",
  "Duplicate warnings",
  "Import summary",
  "Review extracted fields",
  "Assign owners",
  "Track dates and work",
] as const;

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

function PostSubmitSteps() {
  return (
    <div>
      <p className="ui-eyebrow">After submit</p>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {POST_SUBMIT_STEPS.map((label, index) => (
          <li
            key={label}
            className="flex items-baseline gap-2 text-[12px] leading-snug text-[var(--text-secondary)]"
          >
            <span
              aria-hidden
              className="w-3 shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]"
            >
              {index + 1}
            </span>
            <span className="min-w-0">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BulkUploadForm({
  organizationId,
  disabled,
  disabledReason,
}: BulkUploadFormProps) {
  const [isPending, startTransition] = useTransition();
  const [activePath, setActivePath] = useState<ImportPath>("csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const signedFilesInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || isPending) return;
    const form = e.currentTarget;
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
          setCsvFile(null);
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
      router.refresh();
    });
  }

  const sourceFileBytes = sourceFiles.reduce((sum, file) => sum + file.size, 0);
  const submitLabel = activePath === "csv" ? "Import contracts" : "Import signed files";
  const hasCsv = csvFile != null;
  const hasFiles = sourceFiles.length > 0;
  const csvSummary = csvFile
    ? `${csvFile.name}, ${formatFileSize(csvFile.size)}`
    : "No CSV selected";

  return (
    <form className="ui-card overflow-hidden p-0" onSubmit={handleSubmit}>
      {/* Import source: underline tabs (lighter chrome than the previous
          rounded-full pill segmented control) so they no longer compete
          with the form section headings. The aria-label carries the
          "Import source" identity for assistive tech. */}
      <div
        className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-5"
        role="tablist"
        aria-label="Import source"
      >
        {IMPORT_METHODS.map((item) => {
          const ItemIcon = item.icon;
          const selected = activePath === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`inline-flex items-center gap-1.5 border-b-2 py-2.5 text-[12.5px] font-semibold transition-colors ${
                selected
                  ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => {
                setActivePath(item.key);
                setResult(null);
              }}
            >
              <ItemIcon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {(disabledReason || result) && (
        <div className="space-y-2.5 border-b border-[var(--border-subtle)] px-5 py-3.5">
          {disabledReason && (
            <p className="ui-alert-warning text-sm" role="status">
              {disabledReason}
            </p>
          )}

          {result && (
            <div
              className={`text-sm ${result.type === "error" ? "ui-alert-error" : "ui-alert-success"}`}
              role={result.type === "error" ? "alert" : "status"}
              aria-live={result.type === "error" ? "assertive" : "polite"}
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
                      <a className="ui-link" href={`/api/import/contracts/${result.jobId}`}>
                        Open job details
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-5 px-5 py-4">
        {activePath === "csv" ? (
          <>
            <div>
              <label htmlFor="csvFile" className="ui-label">
                CSV file
              </label>
              <div
                className="mt-2 flex max-w-md flex-col gap-2 rounded-md border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,transparent)] p-2 sm:flex-row sm:items-center"
              >
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={() => csvInputRef.current?.click()}
                  className="ui-btn-secondary inline-flex min-h-8 shrink-0 items-center justify-center gap-2 px-3 text-[12.5px] disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Choose CSV
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 px-1 text-[12.5px] text-[var(--text-secondary)]">
                  <span
                    aria-hidden
                    className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: hasCsv ? "var(--success-ink)" : "var(--border-strong)",
                      boxShadow: hasCsv
                        ? "0 0 0 3px color-mix(in oklab, var(--success-soft) 38%, transparent)"
                        : "0 0 0 3px color-mix(in oklab, var(--border-strong) 32%, transparent)",
                    }}
                  />
                  <span className="truncate">{csvSummary}</span>
                </div>
              </div>
              <input
                ref={csvInputRef}
                id="csvFile"
                name="csvFile"
                type="file"
                required
                accept=".csv,text/csv"
                disabled={disabled || isPending}
                onChange={(event) => setCsvFile(event.currentTarget.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>

            <div>
              <p className="ui-eyebrow">Minimum spreadsheet shape</p>
              <dl className="mt-2 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
                {CSV_COLUMN_GROUPS.map((group) => (
                  <div
                    key={group.label}
                    className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-3 py-1.5"
                  >
                    <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {group.label}
                    </dt>
                    <dd className="min-w-0 space-y-0.5">
                      {group.lines.map((line) => (
                        <p
                          key={line}
                          className="text-[12.5px] leading-snug text-[var(--text-primary)]"
                        >
                          {line}
                        </p>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <a
                  href="/api/import/template"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))]"
                  download
                >
                  <Download className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Download template
                </a>
                <p className="text-[11.5px] text-[var(--text-tertiary)]">
                  Template includes every column above.
                </p>
              </div>
            </div>

            <PostSubmitSteps />
          </>
        ) : (
          <>
            <div>
              <label htmlFor="signedFiles" className="ui-label">
                Signed PDF or DOCX files
              </label>
              <div
                className="mt-2 flex max-w-md flex-col gap-2 rounded-md border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,transparent)] p-2 sm:flex-row sm:items-center"
              >
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={() => signedFilesInputRef.current?.click()}
                  className="ui-btn-secondary inline-flex min-h-8 shrink-0 items-center justify-center gap-2 px-3 text-[12.5px] disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                  Choose files
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 px-1 text-[12.5px] text-[var(--text-secondary)]">
                  <span
                    aria-hidden
                    className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: hasFiles ? "var(--success-ink)" : "var(--border-strong)",
                      boxShadow: hasFiles
                        ? "0 0 0 3px color-mix(in oklab, var(--success-soft) 38%, transparent)"
                        : "0 0 0 3px color-mix(in oklab, var(--border-strong) 32%, transparent)",
                    }}
                  />
                  <span className="truncate">
                    {hasFiles
                      ? `${sourceFiles.length} file${sourceFiles.length === 1 ? "" : "s"}, ${formatFileSize(sourceFileBytes)}`
                      : "No files selected"}
                  </span>
                </div>
              </div>
              <input
                ref={signedFilesInputRef}
                id="signedFiles"
                aria-label="Signed PDF or DOCX files"
                name="files"
                type="file"
                multiple
                required
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={disabled || isPending}
                onChange={(event) => setSourceFiles(Array.from(event.currentTarget.files ?? []))}
                className="sr-only"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--text-secondary)]">
                  PDF or DOCX
                </span>
                <span className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  20 MB per file
                </span>
              </div>
            </div>

            <PostSubmitSteps />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,transparent)] px-5 py-3">
        <p className="text-[12px] text-[var(--text-tertiary)]">
          {activePath === "csv"
            ? hasCsv
              ? "Ready to import."
              : "Choose a CSV to continue."
            : hasFiles
              ? "Ready to import."
              : "Choose files to continue."}
        </p>
        <button
          type="submit"
          disabled={disabled || isPending || (activePath === "csv" ? !hasCsv : !hasFiles)}
          className="ui-btn-primary inline-flex min-h-9 items-center px-4 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Importing..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
