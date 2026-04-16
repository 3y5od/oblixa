"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Upload, X, FileText } from "lucide-react";
import { createContract } from "@/actions/contracts";
import { formatFileSize } from "@/lib/format-file-size";

interface UploadFormProps {
  organizationId: string;
  /** When true, form cannot be submitted (e.g. subscription required). */
  disabled?: boolean;
  disabledReason?: string;
}

export function UploadForm({
  organizationId,
  disabled,
  disabledReason,
}: UploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    const accepted = arr.filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const skipped = arr.length - accepted.length;
    if (skipped > 0) {
      setFileNotice(
        `${skipped} file${skipped === 1 ? "" : "s"} skipped — only PDF and DOCX are supported.`
      );
    } else {
      setFileNotice(null);
    }
    setFiles((prev) => [...prev, ...accepted]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (disabled) return;
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    formData.delete("files");
    formData.set("organizationId", organizationId);
    for (const file of files) {
      formData.append("files", file);
    }

    setError(null);
    startTransition(async () => {
      const result = await createContract(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      {disabled && disabledReason && (
        <div className="ui-alert-warning">
          {disabledReason}
        </div>
      )}
      {error && (
        <div className="ui-alert-error">
          {error}
        </div>
      )}
      {fileNotice && !error && (
        <div className="ui-alert-warning">
          {fileNotice}
        </div>
      )}

      <div className="ui-toolbar justify-between gap-3">
        <p className="ui-muted-tight text-[13px]">
          PDF and DOCX up to 20 MB per file. Files are validated server-side; unsupported types are rejected.
        </p>
        <span className="ui-chip">Step 1 of 3</span>
      </div>

      <section className="space-y-4">
        <div>
          <p className="ui-eyebrow">Record metadata</p>
          <h2 className="ui-section-title mt-2 text-xl">Give the contract a durable identity</h2>
        </div>

        <div>
          <label htmlFor="title" className="ui-label">
            Contract title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g., Acme Corp MSA 2025"
            className="ui-input mt-1 w-full"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="counterparty" className="ui-label">
              Counterparty
            </label>
            <input
              id="counterparty"
              name="counterparty"
              type="text"
              placeholder="e.g., Acme Corp"
              className="ui-input mt-1 w-full min-w-0"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="contractType" className="ui-label">
              Contract type
            </label>
            <select
              id="contractType"
              name="contractType"
              className="ui-input mt-1 w-full min-w-0"
            >
              <option value="">Select type</option>
              <option value="MSA">Master Service Agreement</option>
              <option value="SOW">Statement of Work</option>
              <option value="NDA">Non-Disclosure Agreement</option>
              <option value="SaaS">SaaS Agreement</option>
              <option value="Employment">Employment Agreement</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Files</p>
          <h2 className="ui-section-title mt-2 text-xl">Upload the signed source documents</h2>
        </div>
        <span id="files-label" className="ui-label">
          Contract files (PDF or DOCX)
        </span>
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby="files-label"
          aria-disabled={disabled}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`group mt-1 flex min-h-[220px] items-center justify-center rounded-[1.75rem] border border-dashed px-5 py-8 transition-all duration-200 sm:min-h-[240px] sm:px-6 sm:py-10 ${
            disabled
              ? "cursor-not-allowed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_56%,transparent)] opacity-50"
              : isDragOver
                ? "cursor-pointer border-[var(--accent-strong)] bg-[color:color-mix(in_oklab,var(--accent-soft)_56%,transparent)] shadow-[var(--shadow-glow)]"
                : "cursor-pointer border-[var(--border-subtle)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--surface)_90%,white),color-mix(in_oklab,var(--surface-muted)_54%,transparent))] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-1)]"
          }`}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            if (!disabled) handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,white)] shadow-[var(--shadow-1)] transition-transform duration-200 group-hover:scale-[1.02]">
              <Upload className="h-6 w-6 text-[var(--accent-strong)]" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">
              Drop files or click to browse
            </p>
            <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">PDF or DOCX · max 20 MB each</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_86%,white)] px-4 py-3 shadow-[var(--shadow-1)]"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[var(--text-tertiary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{file.name}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  aria-label={`Remove ${file.name} from list`}
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] pt-6">
        <Link href="/contracts" className="ui-btn-secondary px-5 py-2.5 text-[13px]">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || disabled}
          className="ui-btn-primary px-5 py-2.5 text-[13px] disabled:opacity-50"
        >
          {isPending ? "Uploading..." : "Create contract"}
        </button>
      </div>
    </form>
  );
}
