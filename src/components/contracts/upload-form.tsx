"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, CheckCircle2, Tag } from "lucide-react";
import { createContract } from "@/actions/contracts";
import { formatFileSize } from "@/lib/format-file-size";
import { pushAppHref } from "@/lib/navigation/client-navigation";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";

const CONTRACT_TYPE_OPTIONS: UiSelectOption[] = [
  { value: "MSA", label: "Master Service Agreement" },
  { value: "SOW", label: "Statement of Work" },
  { value: "NDA", label: "Non-Disclosure Agreement" },
  { value: "SaaS", label: "SaaS Agreement" },
  { value: "Employment", label: "Employment Agreement" },
  { value: "Other", label: "Other" },
];
import {
  clearUploadMetadataDraft,
  readUploadMetadataDraft,
  writeUploadMetadataDraft,
} from "@/lib/security/client-storage";

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
  ownerLabel: string;
  contractType: string;
  region: string;
  annualValue: string;
  tags: string;
  sourceSystem: string;
  externalReferenceId: string;
};

const emptyMetadata: MetadataDraft = {
  title: "",
  counterparty: "",
  ownerLabel: "",
  contractType: "",
  region: "",
  annualValue: "",
  tags: "",
  sourceSystem: "",
  externalReferenceId: "",
};

export function UploadForm({
  organizationId,
  disabled,
  disabledReason,
}: UploadFormProps) {
  const router = useRouter();
  const [metadata, setMetadata] = useState<MetadataDraft>(emptyMetadata);
  const [runExtraction, setRunExtraction] = useState(true);
  const [tagInput, setTagInput] = useState("");
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
      m.ownerLabel.trim() !== "" ||
      m.contractType.trim() !== "" ||
      m.region.trim() !== "" ||
      m.annualValue.trim() !== "" ||
      m.tags.trim() !== "" ||
      m.sourceSystem.trim() !== "" ||
      m.externalReferenceId.trim() !== ""
    );
  }, [files.length, metadata]);

  const hasTypedMetadata = useMemo(() => {
    const m = metadata;
    return (
      m.title.trim() !== "" ||
      m.counterparty.trim() !== "" ||
      m.ownerLabel.trim() !== "" ||
      m.contractType.trim() !== ""
    );
  }, [metadata]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const parsed = readUploadMetadataDraft(organizationId);
      if (parsed) {
        setMetadata((prev) => ({
          ...prev,
          title: typeof parsed.title === "string" ? parsed.title : prev.title,
          counterparty: typeof parsed.counterparty === "string" ? parsed.counterparty : prev.counterparty,
          ownerLabel: typeof parsed.ownerLabel === "string" ? parsed.ownerLabel : prev.ownerLabel,
          contractType: typeof parsed.contractType === "string" ? parsed.contractType : prev.contractType,
          region: typeof parsed.region === "string" ? parsed.region : prev.region,
          annualValue: typeof parsed.annualValue === "string" ? parsed.annualValue : prev.annualValue,
          tags: typeof parsed.tags === "string" ? parsed.tags : prev.tags,
          sourceSystem: typeof parsed.sourceSystem === "string" ? parsed.sourceSystem : prev.sourceSystem,
          externalReferenceId:
            typeof parsed.externalReferenceId === "string" ? parsed.externalReferenceId : prev.externalReferenceId,
        }));
      }
      setHydratedFromStorage(true);
    });
  }, [organizationId]);

  useEffect(() => {
    if (!hydratedFromStorage || typeof window === "undefined") return;
    const handle = window.setTimeout(() => {
      if (!hasMeaningfulDraft) {
        clearUploadMetadataDraft(organizationId);
        return;
      }
      writeUploadMetadataDraft(organizationId, metadata);
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
    formData.set("ownerLabel", metadata.ownerLabel.trim());
    formData.set("contractType", metadata.contractType.trim());
    formData.set("region", metadata.region.trim());
    formData.set("annualValue", metadata.annualValue.trim());
    formData.set("tags", metadata.tags.trim());
    formData.set("sourceSystem", metadata.sourceSystem.trim());
    formData.set("externalReferenceId", metadata.externalReferenceId.trim());
    formData.set("runExtraction", runExtraction ? "1" : "0");
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

      clearUploadMetadataDraft(organizationId);

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
      if (!pushAppHref(router, result.redirectTo)) {
        setError("The contract was created, but the detail page could not be opened automatically.");
      }
    });
  }

  const submitLabel = files.length > 0 ? "Upload contract" : "Create record";
  const pendingLabel = files.length > 0 ? "Uploading…" : "Saving…";
  const pendingNotice =
    isPending && files.length > 0
      ? "Uploading the contract and confirming which source files stored successfully. If any file fails, you will land on the detail page with recovery steps."
      : isPending
        ? "Saving the contract record. Add a signed source file later to unlock extraction and source-backed review."
        : null;

  const noSourceWarn = files.length === 0 && hasTypedMetadata;
  const parsedTags = metadata.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface-raised)]"
    >
      <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="ui-eyebrow">Contract intake</p>
          {files.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[10.5px]">
              <span className="font-mono tabular-nums text-[var(--text-tertiary)]">
                {files.length} file{files.length === 1 ? "" : "s"}
              </span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span className="font-mono tabular-nums text-[var(--text-tertiary)]">
                {formatFileSize(totalFileBytes)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {(disabled && disabledReason) ||
      error ||
      (uploadOutcome && !error) ||
      (fileNotice && !error) ||
      (pendingNotice && !error) ||
      (hydratedFromStorage && hasMeaningfulDraft && !error) ? (
        <div className="space-y-3 px-5 py-4 sm:px-6">
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
            <div
              className="ui-soft-details px-4 py-3 text-[12.5px] text-[var(--text-secondary)]"
              role="status"
              aria-live="polite"
            >
              {pendingNotice}
            </div>
          )}
          {hydratedFromStorage && hasMeaningfulDraft && !error && (
            <div className="ui-status-panel ui-status-panel-info px-4 py-2 text-[12.5px]" role="status">
              Your contract details are saved in this browser until you create the contract or clear the form.
            </div>
          )}
        </div>
      ) : null}

      <section className="space-y-2.5 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <p className="ui-eyebrow">Source documents</p>
          {files.length === 0 ? (
            noSourceWarn ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[color:color-mix(in_oklab,var(--warning-ink)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_20%,var(--surface-raised))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--warning-ink)]">
                <span
                  aria-hidden
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{
                    background: "var(--warning-ink)",
                    boxShadow:
                      "0 0 0 3px color-mix(in oklab, var(--warning-soft) 42%, transparent)",
                  }}
                />
                Attach a file to extract
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)]">
                <span
                  aria-hidden
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{
                    background: "var(--border-strong)",
                    boxShadow:
                      "0 0 0 3px color-mix(in oklab, var(--border-strong) 28%, transparent)",
                  }}
                />
                No source yet
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[color:color-mix(in_oklab,var(--success-ink)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--success-ink)]">
              <span
                aria-hidden
                className="inline-flex h-2 w-2 rounded-full"
                style={{
                  background: "var(--success-ink)",
                  boxShadow:
                    "0 0 0 3px color-mix(in oklab, var(--success-soft) 42%, transparent)",
                }}
              />
              {files.length} attached
            </span>
          )}
        </div>

        {selectionNotice && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="ui-chip">{selectionNotice.accepted} accepted</span>
            {selectionNotice.duplicate > 0 ? (
              <span className="ui-chip">{selectionNotice.duplicate} duplicate</span>
            ) : null}
            {selectionNotice.skippedType > 0 ? (
              <span className="ui-chip">{selectionNotice.skippedType} unsupported</span>
            ) : null}
            {selectionNotice.skippedSize > 0 ? (
              <span className="ui-chip">{selectionNotice.skippedSize} over size limit</span>
            ) : null}
          </div>
        )}

        <span id="files-label" className="sr-only">
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
          className={`group flex min-h-[96px] items-center justify-center rounded-xl border border-dashed px-5 py-4 transition-[border-color,background-color,box-shadow,transform] duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] ${
            disabled
              ? "cursor-not-allowed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_56%,transparent)] opacity-50"
              : isDragOver
                ? "cursor-pointer border-[var(--accent-strong)] bg-[color:color-mix(in_oklab,var(--accent-soft)_56%,transparent)] shadow-[var(--shadow-glow)]"
                : "cursor-pointer border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-1)]"
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
          <div className="flex items-center gap-3 text-left">
            <div className="ui-icon-tile h-9 w-9 shrink-0 transition-transform duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] group-hover:scale-[1.02]">
              <Upload className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                Drop files or click to browse
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">PDF or DOCX, max 20 MB each</p>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          id="source-files-input"
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {files.length > 0 ? (
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="ui-support-panel flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={16} className="shrink-0 text-[var(--text-tertiary)]" />
                  <span className="truncate text-sm text-[var(--text-primary)]">{file.name}</span>
                  <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
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
        ) : null}

        <label
          className={`flex items-center gap-2 py-1 text-[12.5px] ${
            files.length === 0
              ? "cursor-not-allowed text-[var(--text-tertiary)]"
              : "cursor-pointer text-[var(--text-secondary)]"
          }`}
        >
          <input
            type="checkbox"
            className="ui-checkbox"
            checked={files.length > 0 && runExtraction}
            disabled={files.length === 0}
            onChange={(e) => setRunExtraction(e.target.checked)}
          />
          Run extraction after upload
          {files.length === 0 ? (
            <span className="ml-auto inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)]">
              Needs file
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center rounded-md border border-[color:color-mix(in_oklab,var(--success-ink)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--success-ink)]">
              Recommended
            </span>
          )}
        </label>
      </section>

      <section className="space-y-3.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-4 sm:px-6">
        <p className="ui-eyebrow">Record metadata</p>

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
            placeholder="Add a contract title"
            className="ui-input-compact mt-1 w-full"
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
              placeholder="Counterparty name"
              className="ui-input-compact mt-1 w-full min-w-0"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="ownerLabel" className="ui-label">
              Owner
            </label>
            <input
              id="ownerLabel"
              name="ownerLabel"
              type="text"
              value={metadata.ownerLabel}
              onChange={(e) => setMetadata((m) => ({ ...m, ownerLabel: e.target.value }))}
              placeholder="Owner full name"
              className="ui-input-compact mt-1 w-full min-w-0"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="contractType" className="ui-label">
              Contract type
            </label>
            <UiSelect
              className="mt-1 block w-full"
              buttonClassName="w-full"
              name="contractType"
              value={metadata.contractType}
              onChange={(value) => setMetadata((m) => ({ ...m, contractType: value }))}
              options={CONTRACT_TYPE_OPTIONS}
              placeholder="Select type"
              ariaLabel="Contract type"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="tags" className="ui-label">
              Tags
            </label>
            <div
              className="ui-input-compact mt-1 flex w-full min-w-0 flex-wrap items-center gap-1.5"
              onClick={() => document.getElementById("tags")?.focus()}
            >
              <Tag
                className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]"
                strokeWidth={1.85}
                aria-hidden
              />
              {parsedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] py-0.5 pl-2 pr-1 text-[11px] font-medium leading-none text-[var(--accent-strong)]"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = parsedTags.filter((t) => t !== tag);
                      setMetadata((m) => ({ ...m, tags: next.join(", ") }));
                    }}
                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-strong)_18%,transparent)]"
                  >
                    <X className="h-2.5 w-2.5" strokeWidth={2.2} aria-hidden />
                  </button>
                </span>
              ))}
              <input
                id="tags"
                name="tagsInput"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "," || e.key === "Enter") {
                    e.preventDefault();
                    const next = tagInput.trim();
                    if (next && !parsedTags.includes(next)) {
                      setMetadata((m) => ({
                        ...m,
                        tags: [...parsedTags, next].join(", "),
                      }));
                    }
                    setTagInput("");
                  } else if (
                    e.key === "Backspace" &&
                    tagInput === "" &&
                    parsedTags.length > 0
                  ) {
                    e.preventDefault();
                    setMetadata((m) => ({
                      ...m,
                      tags: parsedTags.slice(0, -1).join(", "),
                    }));
                  }
                }}
                onBlur={() => {
                  const next = tagInput.trim();
                  if (next && !parsedTags.includes(next)) {
                    setMetadata((m) => ({
                      ...m,
                      tags: [...parsedTags, next].join(", "),
                    }));
                  }
                  setTagInput("");
                }}
                placeholder={parsedTags.length === 0 ? "Add a tag" : ""}
                className="min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm leading-tight text-[var(--text-primary)] outline-none placeholder:text-[color:color-mix(in_oklab,var(--text-tertiary)_70%,transparent)]"
              />
            </div>
            <input type="hidden" name="tags" value={metadata.tags} />
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
              placeholder="Region or geography"
              className="ui-input-compact mt-1 w-full min-w-0"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="annualValue" className="ui-label">
              Annual value
            </label>
            <div className="relative mt-1">
              <span
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:color-mix(in_oklab,var(--text-tertiary)_75%,transparent)]"
                aria-hidden
              >
                USD
              </span>
              <input
                id="annualValue"
                name="annualValue"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={metadata.annualValue}
                onChange={(e) => setMetadata((m) => ({ ...m, annualValue: e.target.value }))}
                placeholder="Annual amount"
                className="ui-input-compact w-full min-w-0 pl-11"
              />
            </div>
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
              placeholder="Where it came from"
              className="ui-input-compact mt-1 w-full min-w-0"
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
              placeholder="External record ID"
              className="ui-input-compact mt-1 w-full min-w-0"
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-raised)_94%,transparent)] px-5 py-3 backdrop-blur sm:px-6">
        {files.length > 0 ? (
          <span className="mr-auto inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--success-ink)]">
            <span
              aria-hidden
              className="inline-flex h-2 w-2 rounded-full"
              style={{
                background: "var(--success-ink)",
                boxShadow:
                  "0 0 0 3px color-mix(in oklab, var(--success-soft) 42%, transparent)",
              }}
            />
            Ready · {files.length} file{files.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="mr-auto inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)]">
            <span
              aria-hidden
              className="inline-flex h-2 w-2 rounded-full"
              style={{
                background: "var(--border-strong)",
                boxShadow:
                  "0 0 0 3px color-mix(in oklab, var(--border-strong) 24%, transparent)",
              }}
            />
            Record only
          </span>
        )}
        <Link href="/contracts" className="ui-btn-secondary px-4 py-2 text-[12px]">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || disabled}
          className="ui-btn-primary px-4 py-2 text-[12px] disabled:opacity-50"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
