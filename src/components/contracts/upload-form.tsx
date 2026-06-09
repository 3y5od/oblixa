"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Database,
  FileSignature,
  FileUp,
  Globe,
  Hash,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { createContract } from "@/actions/contracts";
import { pushAppHref } from "@/lib/navigation/client-navigation";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetaChip } from "@/components/ui/meta-chip";
import { UploadField } from "@/components/contracts/upload-field";
import { UploadSection } from "@/components/contracts/upload-section";
import { SelectedFileList } from "@/components/contracts/selected-file-list";
import { Dropzone } from "@/components/contracts/dropzone";
import { UploadTrustNote } from "@/components/contracts/upload-trust-note";
import { CONTRACT_FILE_MAX_BYTES, CONTRACT_FILE_MAX_MB_LABEL } from "@/lib/constants/upload-limits";
import {
  clearUploadMetadataDraft,
  readUploadMetadataDraft,
  writeUploadMetadataDraft,
} from "@/lib/security/client-storage";

const CONTRACT_TYPE_OPTIONS: UiSelectOption[] = [
  { value: "MSA", label: "Master Service Agreement" },
  { value: "SOW", label: "Statement of Work" },
  { value: "NDA", label: "Non-Disclosure Agreement" },
  { value: "SaaS", label: "SaaS Agreement" },
  { value: "Employment", label: "Employment Agreement" },
  { value: "Other", label: "Other" },
];

export interface UploadFormMember {
  /** Member user id — submitted as the contract owner. */
  value: string;
  /** Display name (falls back to email). */
  label: string;
  /** Member email, shown as the option description. */
  email?: string | null;
}

interface UploadFormProps {
  organizationId: string;
  /** When true, form cannot be submitted (e.g. subscription required). */
  disabled?: boolean;
  disabledReason?: string;
  /** Workspace members — populate the owner picker. */
  members?: UploadFormMember[];
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
  ownerId: string;
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
  ownerId: "",
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
  members = [],
}: UploadFormProps) {
  const router = useRouter();
  const ownerOptions = useMemo<UiSelectOption[]>(
    () =>
      members.map((member) => ({
        value: member.value,
        label: member.label,
      })),
    [members]
  );
  const [metadata, setMetadata] = useState<MetadataDraft>(emptyMetadata);
  const [tagInput, setTagInput] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<FileSelectionNotice | null>(null);
  const [uploadOutcome, setUploadOutcome] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasMeaningfulDraft = useMemo(() => {
    const m = metadata;
    return (
      files.length > 0 ||
      m.title.trim() !== "" ||
      m.counterparty.trim() !== "" ||
      m.ownerId.trim() !== "" ||
      m.contractType.trim() !== "" ||
      m.region.trim() !== "" ||
      m.annualValue.trim() !== "" ||
      m.tags.trim() !== "" ||
      m.sourceSystem.trim() !== "" ||
      m.externalReferenceId.trim() !== ""
    );
  }, [files.length, metadata]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const parsed = readUploadMetadataDraft(organizationId);
      if (parsed) {
        setMetadata((prev) => ({
          ...prev,
          title: typeof parsed.title === "string" ? parsed.title : prev.title,
          counterparty: typeof parsed.counterparty === "string" ? parsed.counterparty : prev.counterparty,
          ownerId: typeof parsed.ownerId === "string" ? parsed.ownerId : prev.ownerId,
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
      if (file.size > CONTRACT_FILE_MAX_BYTES) {
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
        `${accepted.length} file${accepted.length === 1 ? "" : "s"} ready to upload.`
      );
    }
    if (skippedType > 0) {
      messageParts.push(
        `${skippedType} unsupported file${skippedType === 1 ? " was" : "s were"} skipped.`
      );
    }
    if (skippedSize > 0) {
      messageParts.push(
        `${skippedSize} file${skippedSize === 1 ? " exceeds" : "s exceed"} the ${CONTRACT_FILE_MAX_MB_LABEL} limit.`
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
    // The shared Dropzone no longer resets the input, so clear it here: this
    // form tracks files in state, and a cleared input lets the same file be
    // re-picked after it is removed (especially via the compact "add another").
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    formData.set("ownerId", metadata.ownerId.trim());
    formData.set("contractType", metadata.contractType.trim());
    formData.set("region", metadata.region.trim());
    formData.set("annualValue", metadata.annualValue.trim());
    formData.set("tags", metadata.tags.trim());
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
        summaryParts.push("contract-detail suggestions queued");
      } else if (result.extractionStatus === "not_available") {
        summaryParts.push("contract-detail suggestions unavailable in this environment");
      }
      setUploadOutcome(summaryParts.join(" · "));
      if (!pushAppHref(router, result.redirectTo)) {
        setError("The contract was created, but the detail page could not be opened automatically.");
      }
    });
  }

  const canSubmit = metadata.title.trim().length > 0;
  const titleInvalid = titleTouched && metadata.title.trim().length === 0;
  // Lock every metadata control while the workspace can't create the record
  // (viewer / no plan) or a submit is in flight — mirrors the dropzone + CTA.
  const fieldsDisabled = !!disabled || isPending;
  const submitLabel = files.length > 0 ? "Upload contract" : "Create record";
  const pendingLabel = files.length > 0 ? "Uploading…" : "Saving…";
  const pendingNotice =
    isPending && files.length > 0
      ? "Uploading the signed contract and confirming which files stored. If any file fails, you will land on the detail page with recovery steps."
      : isPending
        ? "Saving the contract record. Attach a signed file later to unlock source-backed detail suggestions."
        : null;

  const parsedTags = metadata.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const showNotices =
    (disabled && disabledReason) ||
    error ||
    (uploadOutcome && !error) ||
    (fileNotice && !error) ||
    (pendingNotice && !error) ||
    (hydratedFromStorage && hasMeaningfulDraft && !error);

  const sourceFilesAccept =
    ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="ui-card-raised overflow-hidden p-0"
    >
      {showNotices ? (
        <div className="space-y-3 px-5 pb-1 pt-5 sm:px-6">
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

      <UploadSection
        step={1}
        first
        icon={FileUp}
        title="Source documents"
        lead="Upload the signed agreement, or create the record now and attach a file later."
        aside={
          files.length > 0 ? (
            <StatusBadge status="healthy">
              <span
                aria-hidden
                className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--success-ink)" }}
              />
              {files.length} attached
            </StatusBadge>
          ) : (
            <StatusBadge status="empty">
              <span
                aria-hidden
                className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--border-strong)" }}
              />
              File optional
            </StatusBadge>
          )
        }
      >
        {/* One persistent Dropzone so the file input stays mounted across the
            empty→staged transition: the staged list appears above it and the
            dropzone switches to its compact "add another" variant. */}
        <div className="space-y-3">
          {files.length > 0 ? (
            <SelectedFileList files={files} onRemove={removeFile} disabled={fieldsDisabled} />
          ) : null}
          <Dropzone
            inputRef={fileInputRef}
            inputId="source-files-input"
            multiple
            accept={sourceFilesAccept}
            ariaLabel="Upload signed contract files (PDF or DOCX)"
            variant={files.length > 0 ? "compact" : "full"}
            compactLabel="Add another file"
            size="sm"
            primaryText={
              <>
                Drop signed PDF or DOCX, or{" "}
                <span className="text-[var(--accent-strong)]">browse</span>
              </>
            }
            formats={["PDF", "DOCX"]}
            hint={`Max ${CONTRACT_FILE_MAX_MB_LABEL}`}
            disabled={disabled}
            onFiles={handleFiles}
          />
        </div>

        {selectionNotice && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {selectionNotice.accepted > 0 ? (
              <MetaChip tone="success">{selectionNotice.accepted} accepted</MetaChip>
            ) : null}
            {selectionNotice.duplicate > 0 ? (
              <MetaChip tone="warning">{selectionNotice.duplicate} duplicate</MetaChip>
            ) : null}
            {selectionNotice.skippedType > 0 ? (
              <MetaChip tone="danger">{selectionNotice.skippedType} unsupported</MetaChip>
            ) : null}
            {selectionNotice.skippedSize > 0 ? (
              <MetaChip tone="danger">{selectionNotice.skippedSize} over size limit</MetaChip>
            ) : null}
          </div>
        )}

        {/* Extraction runs after upload whenever the AI provider is configured —
            a static expectation, not a toggle. Suggestions are never trusted
            until reviewed. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
          <span className="inline-flex items-center gap-2 text-[var(--text-tertiary)]">
            <Sparkles
              className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]"
              strokeWidth={1.85}
              aria-hidden
            />
            Source-backed detail suggestions
          </span>
          <span className="text-[11.5px] font-medium text-[var(--accent-strong)]">
            Confirmation required
          </span>
        </div>
        <div className="mt-3">
          <UploadTrustNote />
        </div>
      </UploadSection>

      <UploadSection step={2} icon={ClipboardList} title="Known contract details">
        <div className="space-y-4">
          <UploadField
            id="title"
            label="Contract title"
            required
            icon={FileSignature}
            error={titleInvalid ? "Contract title is required" : undefined}
          >
            <input
              id="title"
              name="title"
              type="text"
              required
              value={metadata.title}
              onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value }))}
              onBlur={() => setTitleTouched(true)}
              placeholder="Add a contract title"
              disabled={fieldsDisabled}
              aria-invalid={titleInvalid || undefined}
              aria-describedby={titleInvalid ? "title-error" : undefined}
              className={`ui-input-compact w-full pl-9 ${
                titleInvalid
                  ? "border-[color:color-mix(in_oklab,var(--danger-ink)_55%,var(--border-strong))] focus-visible:border-[color:color-mix(in_oklab,var(--danger-ink)_60%,var(--border-strong))] focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--danger-ink)_45%,transparent),0_0_0_4px_color-mix(in_oklab,var(--danger-ink)_18%,transparent)]"
                  : ""
              }`}
            />
          </UploadField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UploadField id="counterparty" label="Counterparty" icon={Building2}>
              <input
                id="counterparty"
                name="counterparty"
                type="text"
                value={metadata.counterparty}
                onChange={(e) => setMetadata((m) => ({ ...m, counterparty: e.target.value }))}
                placeholder="Counterparty name"
                disabled={fieldsDisabled}
                className="ui-input-compact w-full min-w-0 pl-9"
              />
            </UploadField>
            <UploadField id="ownerId" label="Owner">
              <UiSelect
                id="ownerId"
                className="block w-full"
                buttonClassName="w-full"
                value={metadata.ownerId}
                onChange={(value) => setMetadata((m) => ({ ...m, ownerId: value }))}
                options={ownerOptions}
                placeholder={ownerOptions.length > 0 ? "You (creator)" : "No workspace members"}
                search
                searchPlaceholder="Search members"
                emptyLabel="No members match"
                portal
                disabled={fieldsDisabled || ownerOptions.length === 0}
              />
            </UploadField>
          </div>

          <UploadField id="contractType" label="Contract type">
            <UiSelect
              id="contractType"
              className="block w-full"
              buttonClassName="w-full"
              name="contractType"
              value={metadata.contractType}
              onChange={(value) => setMetadata((m) => ({ ...m, contractType: value }))}
              options={CONTRACT_TYPE_OPTIONS}
              placeholder="Select contract type"
              portal
              disabled={fieldsDisabled}
            />
          </UploadField>
        </div>
      </UploadSection>

      <details className="group border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-6 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_28%,var(--surface-raised))] text-[var(--accent-strong)]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} />
          </span>
          <span className="ui-caps-2 text-[11px] leading-none text-[var(--text-primary)]">
            Add more details
          </span>
          <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
            Optional
          </span>
          <ChevronDown
            className="ml-auto h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-180"
            strokeWidth={2}
            aria-hidden
          />
        </summary>
        <div className="ui-details-reveal px-5 pb-5 sm:px-6">
          <div className="space-y-4">
            <div>
              <p className="ui-caps-3 mb-2.5 text-[10px] leading-none text-[var(--text-tertiary)]">
                Commercial
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UploadField id="region" label="Region" icon={Globe}>
                  <input
                    id="region"
                    name="region"
                    type="text"
                    value={metadata.region}
                    onChange={(e) => setMetadata((m) => ({ ...m, region: e.target.value }))}
                    placeholder="Region or geography"
                    disabled={fieldsDisabled}
                    className="ui-input-compact w-full min-w-0 pl-9"
                  />
                </UploadField>
                <UploadField id="annualValue" label="Annual value">
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="ui-caps-3 inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9.5px] leading-none text-[var(--text-tertiary)]">
                      USD
                    </span>
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
                    disabled={fieldsDisabled}
                    className="ui-input-compact w-full min-w-0 pl-[3.25rem] tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </UploadField>
              </div>
            </div>

            <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] pt-4">
              <p className="ui-caps-3 mb-2.5 text-[10px] leading-none text-[var(--text-tertiary)]">
                Source
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UploadField id="sourceSystem" label="Source system" icon={Database}>
                  <input
                    id="sourceSystem"
                    name="sourceSystem"
                    type="text"
                    value={metadata.sourceSystem}
                    onChange={(e) => setMetadata((m) => ({ ...m, sourceSystem: e.target.value }))}
                    placeholder="Where it came from"
                    disabled={fieldsDisabled}
                    className="ui-input-compact w-full min-w-0 pl-9"
                  />
                </UploadField>
                <UploadField id="externalReferenceId" label="External reference" icon={Hash}>
                  <input
                    id="externalReferenceId"
                    name="externalReferenceId"
                    type="text"
                    value={metadata.externalReferenceId}
                    onChange={(e) => setMetadata((m) => ({ ...m, externalReferenceId: e.target.value }))}
                    placeholder="External record ID"
                    disabled={fieldsDisabled}
                    className="ui-input-compact w-full min-w-0 pl-9 font-mono"
                  />
                </UploadField>
              </div>
            </div>

            <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] pt-4">
              <UploadField id="tags" label="Tags" hint="Enter to add">
                <div
                  aria-disabled={fieldsDisabled}
                  className={`ui-input-compact flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${
                    fieldsDisabled ? "cursor-not-allowed opacity-[0.55]" : ""
                  }`}
                  onClick={() => {
                    if (!fieldsDisabled) document.getElementById("tags")?.focus();
                  }}
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
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-strong)_18%,transparent)]"
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
                    placeholder={parsedTags.length === 0 ? "Add a tag and press Enter" : ""}
                    disabled={fieldsDisabled}
                    className="min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm leading-tight text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] disabled:cursor-not-allowed"
                  />
                </div>
              </UploadField>
              <input type="hidden" name="tags" value={metadata.tags} />
            </div>
          </div>
        </div>
      </details>

      {/* Action footer — a plain card footer (not sticky), reached by scrolling to
          the end of the form. Mirrors the /contracts/bulk footer. */}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,transparent)] px-5 py-3.5 sm:px-6">
        {!canSubmit ? (
          <span className="mr-auto inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
            <span
              aria-hidden
              className="inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--border-strong)" }}
            />
            Title required
          </span>
        ) : files.length > 0 ? (
          <span className="mr-auto inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--text-tertiary)]">
            Confirm details next
            <ArrowRight className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={2} aria-hidden />
          </span>
        ) : null}
        <Link
          href="/contracts"
          className="ui-btn-ghost rounded-full px-4 py-2 text-[13px]"
        >
          Cancel
        </Link>
        {/* §release-state /contracts/new: upload is the primary path. The button
            stays secondary until the record is ready (a title is entered) and
            only becomes the primary CTA once a file is staged; fileless creation
            is a deliberate, de-emphasized secondary action ("Create record"). */}
        <button
          type="submit"
          disabled={isPending || disabled || !canSubmit}
          className={`inline-flex min-w-[9rem] items-center justify-center rounded-full px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50 ${
            files.length > 0 && canSubmit ? "ui-btn-primary" : "ui-btn-secondary"
          }`}
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
