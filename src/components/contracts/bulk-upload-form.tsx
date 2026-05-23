"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, FileText } from "lucide-react";
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

const CSV_COLUMN_GROUPS = [
  { label: "Required", value: "title, counterparty" },
  { label: "Optional", value: "contract_type, owner_email, region" },
  { label: "Tracking", value: "source_system, external_reference_id" },
] as const;

const REVIEW_PATH_STEPS = [
  "Review extracted fields",
  "Assign owners",
  "Track dates and work",
  "Use evidence and reports",
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
          const response = await fetch("/api/import/contracts", {
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
  const submitLabel = activePath === "csv" ? "Import CSV" : "Import signed files";
  const csvSummary = csvFile
    ? `${csvFile.name}, ${formatFileSize(csvFile.size)}`
    : "No CSV selected";

  return (
    <form className="ui-card overflow-hidden p-0" onSubmit={handleSubmit}>
      <div className="border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="ui-eyebrow">Import source</p>
          <div
            className="inline-grid shrink-0 grid-cols-2 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] p-1"
            role="tablist"
            aria-label="Import method"
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
                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors ${
                    selected
                      ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--shadow-1)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
        </div>
      </div>

      {(disabledReason || result) && (
        <div className="space-y-3 px-5 py-4 sm:px-6">
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

      <div className="grid gap-0 border-t border-[var(--border-subtle)] lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-5 px-5 py-5 sm:px-6 lg:border-r lg:border-[var(--border-subtle)]">
          {activePath === "csv" ? (
            <>
              <div>
                <label htmlFor="csvFile" className="ui-label">
                  CSV file
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={disabled || isPending}
                    onClick={() => csvInputRef.current?.click()}
                    className="ui-btn-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-[13px] disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    Choose CSV
                  </button>
                  <div className="ui-soft-details flex min-h-11 min-w-0 flex-1 items-center px-4 py-2 text-[12.5px] text-[var(--text-secondary)]">
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

              <div className="space-y-2">
                <p className="ui-eyebrow">Minimum spreadsheet shape</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CSV_COLUMN_GROUPS.map((group) => (
                    <div key={group.label} className="ui-soft-details px-3 py-2">
                      <span className="ui-caps-3 text-[var(--text-tertiary)]">{group.label}</span>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {group.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="signedFiles" className="ui-label">
                  Signed PDF or DOCX files
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={disabled || isPending}
                    onClick={() => signedFilesInputRef.current?.click()}
                    className="ui-btn-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-[13px] disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    Choose files
                  </button>
                  <div className="ui-soft-details flex min-h-11 min-w-0 flex-1 items-center px-4 py-2 text-[12.5px] text-[var(--text-secondary)]">
                    <span className="truncate">
                      {sourceFiles.length > 0
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
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="ui-chip">PDF or DOCX</span>
                  <span className="ui-chip">20 MB max</span>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-3 bg-[color:color-mix(in_oklab,var(--surface-muted)_34%,transparent)] px-5 py-5 sm:px-6">
          <p className="ui-eyebrow">Review path</p>
          <ol className="space-y-2 text-[12.5px] text-[var(--text-secondary)]">
            {REVIEW_PATH_STEPS.map((item, index) => (
              <li key={item} className="flex gap-2">
                <span className="font-mono text-[var(--text-tertiary)]">{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <button
          type="submit"
          disabled={disabled || isPending}
          className="ui-btn-primary px-5 py-2.5 text-[12.5px] disabled:opacity-50"
        >
          {isPending ? "Importing..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
