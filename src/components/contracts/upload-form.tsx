"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createContract } from "@/actions/contracts";
import { formatFileSize } from "@/lib/format-file-size";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";

interface UploadFormProps {
  organizationId: string;
  /** When true, form cannot be submitted (e.g. subscription required). */
  disabled?: boolean;
  disabledReason?: string;
}

type FileSelectionNotice = {
  accepted: number;
  duplicate: number;
  skippedType: number;
  skippedSize: number;
};

function fileSelectionKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

type MetadataDraft = {
  title: string;
  counterparty: string;
  contractType: string;
  region: string;
  annualValue: string;
  sourceSystem: string;
  externalReferenceId: string;
};

const emptyMetadata: MetadataDraft = {
  title: "",
  counterparty: "",
  contractType: "",
  region: "",
  annualValue: "",
  sourceSystem: "",
  externalReferenceId: "",
};

function uploadDraftStorageKey(organizationId: string) {
  return `oblixa.uploadDraft.v1:${organizationId}`;
}

export function UploadForm({
  organizationId,
  disabled,
  disabledReason,
}: UploadFormProps) {
  const router = useRouter();
  const [metadata, setMetadata] = useState<MetadataDraft>(emptyMetadata);
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<FileSelectionNotice | null>(null);
  const [uploadOutcome, setUploadOutcome] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalFileBytes = files.reduce((sum, file) => sum + file.size, 0);

  const hasMeaningfulDraft = useMemo(() => {
    const m = metadata;
    return (
      files.length > 0 ||
      m.title.trim() !== "" ||
      m.counterparty.trim() !== "" ||
      m.contractType.trim() !== "" ||
      m.region.trim() !== "" ||
      m.annualValue.trim() !== "" ||
      m.sourceSystem.trim() !== "" ||
      m.externalReferenceId.trim() !== ""
    );
  }, [files.length, metadata]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Defer all updates off the effect body to satisfy react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(uploadDraftStorageKey(organizationId));
        if (!raw) {
          setHydratedFromStorage(true);
          return;
        }
        const parsed = JSON.parse(raw) as Partial<MetadataDraft>;
        setMetadata((prev) => ({
          ...prev,
          title: typeof parsed.title === "string" ? parsed.title : prev.title,
          counterparty: typeof parsed.counterparty === "string" ? parsed.counterparty : prev.counterparty,
          contractType: typeof parsed.contractType === "string" ? parsed.contractType : prev.contractType,
          region: typeof parsed.region === "string" ? parsed.region : prev.region,
          annualValue: typeof parsed.annualValue === "string" ? parsed.annualValue : prev.annualValue,
          sourceSystem: typeof parsed.sourceSystem === "string" ? parsed.sourceSystem : prev.sourceSystem,
          externalReferenceId:
            typeof parsed.externalReferenceId === "string" ? parsed.externalReferenceId : prev.externalReferenceId,
        }));
      } catch {
        // ignore corrupt draft
      }
      setHydratedFromStorage(true);
    });
  }, [organizationId]);

  useEffect(() => {
    if (!hydratedFromStorage || typeof window === "undefined") return;
    const handle = window.setTimeout(() => {
      if (!hasMeaningfulDraft) {
        sessionStorage.removeItem(uploadDraftStorageKey(organizationId));
        return;
      }
      sessionStorage.setItem(uploadDraftStorageKey(organizationId), JSON.stringify(metadata));
    }, 450);
    return () => window.clearTimeout(handle);
  }, [hasMeaningfulDraft, hydratedFromStorage, metadata, organizationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasMeaningfulDraft || disabled) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [disabled, hasMeaningfulDraft]);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    const accepted: File[] = [];
    const seen = new Set(files.map(fileSelectionKey));
    let skippedType = 0;
    let skippedSize = 0;
    let duplicate = 0;

    for (const file of arr) {
      const isSupportedType =
        file.type === "application/pdf" ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      if (!isSupportedType) {
        skippedType += 1;
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        skippedSize += 1;
        continue;
      }
      const key = fileSelectionKey(file);
      if (seen.has(key)) {
        duplicate += 1;
        continue;
      }
      seen.add(key);
      accepted.push(file);
    }

    const messageParts: string[] = [];
    if (accepted.length > 0) {
      messageParts.push(
        `${accepted.length} file${accepted.length === 1 ? "" : "s"} ready for intake review.`
      );
    }
    if (skippedType > 0) {
      messageParts.push(
        `${skippedType} unsupported file${skippedType === 1 ? " was" : "s were"} skipped.`
      );
    }
    if (skippedSize > 0) {
      messageParts.push(
        `${skippedSize} file${skippedSize === 1 ? " exceeds" : "s exceed"} the 20 MB limit.`
      );
    }
    if (duplicate > 0) {
      messageParts.push(
        `${duplicate} duplicate file${duplicate === 1 ? " was" : "s were"} ignored.`
      );
    }

    setSelectionNotice(
      accepted.length > 0 || skippedType > 0 || skippedSize > 0 || duplicate > 0
        ? {
            accepted: accepted.length,
            duplicate,
            skippedType,
            skippedSize,
          }
        : null
    );
    setFileNotice(messageParts.length > 0 ? messageParts.join(" ") : null);
    setUploadOutcome(null);
    setFiles((prev) => [...prev, ...accepted]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadOutcome(null);
    setSelectionNotice(null);
  }

  function handleSubmit() {
    if (disabled) return;

    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("title", metadata.title.trim());
    formData.set("counterparty", metadata.counterparty.trim());
    formData.set("contractType", metadata.contractType.trim());
    formData.set("region", metadata.region.trim());
    formData.set("annualValue", metadata.annualValue.trim());
    formData.set("sourceSystem", metadata.sourceSystem.trim());
    formData.set("externalReferenceId", metadata.externalReferenceId.trim());
    for (const file of files) {
      formData.append("files", file);
    }

    setError(null);
    setUploadOutcome(null);
    setSelectionNotice(null);
    startTransition(async () => {
      const result = await createContract(formData);
      if ("error" in result) {
        setError(describeRecoverableMutationError(result.error));
        return;
      }

      try {
        sessionStorage.removeItem(uploadDraftStorageKey(organizationId));
      } catch {
        // ignore
      }

      const summaryParts = [
        `${result.uploadSummary.uploadedFiles} file${result.uploadSummary.uploadedFiles === 1 ? "" : "s"} uploaded`,
      ];
      if (result.uploadSummary.skippedInvalidFiles > 0) {
        summaryParts.push(
          `${result.uploadSummary.skippedInvalidFiles} invalid file${result.uploadSummary.skippedInvalidFiles === 1 ? "" : "s"} skipped`
        );
      }
      if (result.uploadSummary.failedUploadFiles > 0) {
        summaryParts.push(
          `${result.uploadSummary.failedUploadFiles} upload${result.uploadSummary.failedUploadFiles === 1 ? "" : "s"} failed`
        );
      }
      if (result.extractionStatus === "queued") {
        summaryParts.push("extraction queued");
      } else if (result.extractionStatus === "not_available") {
        summaryParts.push("extraction not available in this environment");
      }
      setUploadOutcome(summaryParts.join(" · "));
      router.push(result.redirectTo);
    });
  }

  const submitLabel = files.length > 0 ? "Create contract and start intake" : "Create contract without files";
  const pendingNotice =
    isPending && files.length > 0
      ? "Creating the contract record and confirming which source files stored successfully. If any file fails, you will land on the detail page with recovery steps."
      : isPending
        ? "Creating the contract record. Add a signed source file later to unlock extraction and source-backed review."
        : null;

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-6"
    >
      {disabled && disabledReason && (
        <div className="ui-alert-warning" role="alert">
          {disabledReason}
        </div>
      )}
      {error && (
        <div className="ui-alert-error" role="alert">
          {error}
        </div>
      )}
      {uploadOutcome && !error && (
        <div className="ui-alert-success flex items-start gap-2" role="status" aria-live="polite">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{uploadOutcome}</span>
        </div>
      )}
      {fileNotice && !error && (
        <div className="ui-alert-warning" role="status" aria-live="polite">
          {fileNotice}
        </div>
      )}
      {pendingNotice && !error && (
        <div className="ui-soft-details px-4 py-3 text-[13px] text-[var(--text-secondary)]" role="status" aria-live="polite">
          {pendingNotice}
        </div>
      )}
      {hydratedFromStorage && hasMeaningfulDraft && !error && (
        <div className="ui-status-panel ui-status-panel-info px-4 py-2 text-[12px]" role="status">
          Your contract details are saved in this browser until you create the contract or clear the form.
        </div>
      )}

      <div className="ui-toolbar justify-between gap-3">
        <div>
          <p className="ui-muted-tight text-[13px]">
            PDF and DOCX up to 20 MB per file. We create the contract first, then confirm which source files stored successfully.
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
            Next: upload source documents, run extraction, then approve key operational dates.
          </p>
        </div>
        <span className="ui-chip">First value path</span>
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
            value={metadata.title}
            onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value }))}
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
              value={metadata.counterparty}
              onChange={(e) => setMetadata((m) => ({ ...m, counterparty: e.target.value }))}
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
              value={metadata.contractType}
              onChange={(e) => setMetadata((m) => ({ ...m, contractType: e.target.value }))}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="region" className="ui-label">
              Region
            </label>
            <input
              id="region"
              name="region"
              type="text"
              value={metadata.region}
              onChange={(e) => setMetadata((m) => ({ ...m, region: e.target.value }))}
              placeholder="e.g., North America"
              className="ui-input mt-1 w-full min-w-0"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="annualValue" className="ui-label">
              Annual value
            </label>
            <input
              id="annualValue"
              name="annualValue"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={metadata.annualValue}
              onChange={(e) => setMetadata((m) => ({ ...m, annualValue: e.target.value }))}
              placeholder="e.g., 250000"
              className="ui-input mt-1 w-full min-w-0"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="sourceSystem" className="ui-label">
              Source system
            </label>
            <input
              id="sourceSystem"
              name="sourceSystem"
              type="text"
              value={metadata.sourceSystem}
              onChange={(e) => setMetadata((m) => ({ ...m, sourceSystem: e.target.value }))}
              placeholder="e.g., Salesforce, shared drive"
              className="ui-input mt-1 w-full min-w-0"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="externalReferenceId" className="ui-label">
              External reference
            </label>
            <input
              id="externalReferenceId"
              name="externalReferenceId"
              type="text"
              value={metadata.externalReferenceId}
              onChange={(e) => setMetadata((m) => ({ ...m, externalReferenceId: e.target.value }))}
              placeholder="e.g., CLM-2048"
              className="ui-input mt-1 w-full min-w-0"
            />
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
        <div className="ui-soft-details px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <strong className="text-[var(--text-primary)]">Queued files:</strong> {files.length}
            </span>
            <span>
              <strong className="text-[var(--text-primary)]">Total selected size:</strong> {formatFileSize(totalFileBytes)}
            </span>
          </div>
          {selectionNotice && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong className="text-[var(--text-primary)]">Ready in this selection:</strong> {selectionNotice.accepted}
              </span>
              {selectionNotice.duplicate > 0 && (
                <span>
                  <strong className="text-[var(--text-primary)]">Duplicates ignored:</strong> {selectionNotice.duplicate}
                </span>
              )}
              {selectionNotice.skippedType > 0 && (
                <span>
                  <strong className="text-[var(--text-primary)]">Unsupported:</strong> {selectionNotice.skippedType}
                </span>
              )}
              {selectionNotice.skippedSize > 0 && (
                <span>
                  <strong className="text-[var(--text-primary)]">Over size limit:</strong> {selectionNotice.skippedSize}
                </span>
              )}
            </div>
          )}
          <p className="mt-1">
            We will keep your contract record even if a source file needs to be re-attached later.
          </p>
        </div>
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
          className={`group mt-1 flex min-h-[220px] items-center justify-center rounded-[calc(var(--radius-3xl)-0.125rem)] border border-dashed px-5 py-8 transition-[border-color,background-color,box-shadow,transform] duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] sm:min-h-[240px] sm:px-6 sm:py-10 ${
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
            <div className="ui-icon-tile mx-auto h-14 w-14 transition-transform duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] group-hover:scale-[1.02]">
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
                className="ui-support-panel flex items-center justify-between px-4 py-3"
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
                  className="ui-icon-button min-h-8 min-w-8 border-transparent bg-transparent p-1.5 shadow-none"
                  aria-label={`Remove ${file.name} from list`}
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {files.length === 0 && (
          <div className="ui-soft-details flex items-start gap-2 border-dashed px-4 py-3 text-[12px] text-[var(--text-secondary)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
            <span>
              You can create the contract without files, but extraction and source-backed review will stay blocked until at least one signed document is attached.
            </span>
          </div>
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
          {isPending ? "Creating contract…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
