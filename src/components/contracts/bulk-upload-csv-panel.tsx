import type { RefObject } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import { CreationPipeline } from "@/components/contracts/creation-pipeline";
import { Dropzone } from "@/components/contracts/dropzone";
import { UploadTrustNote } from "@/components/contracts/upload-trust-note";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { MetaChip } from "@/components/ui/meta-chip";
import { formatFileSize } from "@/lib/format-file-size";
import { BulkUploadCsvColumns } from "./bulk-upload-csv-columns";
import { CSV_STEPS, type CsvCheck } from "./bulk-upload-form-types";

export function BulkUploadCsvPanel({
  csvInputRef,
  disabled,
  isPending,
  csvFile,
  csvCheck,
  csvIssue,
  csvError,
  onFiles,
  onClearCsv,
}: {
  csvInputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  isPending: boolean;
  csvFile: File | null;
  csvCheck: CsvCheck | null;
  csvIssue: boolean;
  csvError: string | null;
  onFiles: (files: FileList | null) => void;
  onClearCsv: () => void;
}) {
  return (
    <div role="tabpanel" id="import-panel-csv" aria-labelledby="import-tab-csv" className="space-y-5 px-5 py-4">
      <BulkUploadCsvColumns />
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">Tracker CSV file</p>
          <KeyValueChip label="Max" value="2 MB" />
        </div>
        <div className="mt-2">
          <Dropzone
            inputRef={csvInputRef}
            inputId="csv-file-input"
            name="csvFile"
            accept=".csv,text/csv"
            ariaLabel="Tracker CSV file"
            primaryText={
              <>
                <span className="text-[var(--accent-strong)]">Choose tracker CSV</span>
                <span className="mt-0.5 block text-[11.5px] font-normal text-[var(--text-tertiary)]">or drag a UTF-8 CSV file here</span>
              </>
            }
            formats={["CSV"]}
            hint="up to 2 MB"
            note="Contract name and counterparty are required."
            disabled={disabled || isPending}
            onFiles={onFiles}
          />
        </div>
        <div className="mt-2.5">
          <UploadTrustNote body="Imported details are suggested until someone confirms them. Confirmed details then appear in reminders, tasks, reports, and search." />
        </div>
        {csvFile ? (
          <CsvFileCard csvFile={csvFile} csvCheck={csvCheck} csvIssue={csvIssue} onClearCsv={onClearCsv} />
        ) : null}
        <CsvValidationMessages csvError={csvError} csvCheck={csvCheck} />
      </div>
      <CreationPipeline heading="What happens next" steps={CSV_STEPS.map((label) => ({ label }))} layout="compact" />
    </div>
  );
}

function CsvFileCard({
  csvFile,
  csvCheck,
  csvIssue,
  onClearCsv,
}: {
  csvFile: File;
  csvCheck: CsvCheck | null;
  csvIssue: boolean;
  onClearCsv: () => void;
}) {
  return (
    <div className="mt-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
          {csvFile.name}
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
          {formatFileSize(csvFile.size)}
        </span>
        <button
          type="button"
          onClick={onClearCsv}
          aria-label="Remove selected CSV"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] hover:text-[var(--text-primary)]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2">
        {csvCheck == null ? (
          <span className="text-[11px] text-[var(--text-tertiary)]">Checking file...</span>
        ) : (
          <>
            <KeyValueChip label="Rows" value={csvCheck.rows} tone={csvIssue ? "warning" : "success"} />
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
  );
}

function CsvValidationMessages({
  csvError,
  csvCheck,
}: {
  csvError: string | null;
  csvCheck: CsvCheck | null;
}) {
  return (
    <>
      {csvError ? (
        <p className="ui-alert-warning mt-2 text-[12px]" role="status">
          {csvError}
        </p>
      ) : null}
      {csvCheck && csvCheck.missingHeaders.length > 0 ? (
        <div className="mt-2 ui-alert-warning text-[12px]" role="status">
          <p className="text-[12px] font-semibold">Add these required columns before importing</p>
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
              <code className="font-mono text-[10.5px] text-[var(--text-secondary)]">{header}</code>
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}
