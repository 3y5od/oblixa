"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract } from "@/actions/contracts";
import { pushAppHref } from "@/lib/navigation/client-navigation";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import type { UiSelectOption } from "@/components/ui/ui-select";
import { CONTRACT_FILE_MAX_BYTES, CONTRACT_FILE_MAX_MB_LABEL } from "@/lib/constants/upload-limits";
import {
  clearUploadMetadataDraft,
  readUploadMetadataDraft,
  writeUploadMetadataDraft,
} from "@/lib/security/client-storage";
import { UploadDetailsSection } from "./upload-details-section";
import { UploadFormActionBar } from "./upload-form-action-bar";
import { UploadFormNotices } from "./upload-form-notices";
import { UploadSourceSection } from "./upload-source-section";
import {
  emptyMetadata,
  fileSelectionKey,
  type FileSelectionNotice,
  type MetadataDraft,
  type UploadFormMember,
} from "./upload-form-types";

export type { UploadFormMember } from "./upload-form-types";

interface UploadFormProps {
  organizationId: string;
  disabled?: boolean;
  disabledReason?: string;
  members?: UploadFormMember[];
}

export function UploadForm({
  organizationId,
  disabled,
  disabledReason,
  members = [],
}: UploadFormProps) {
  const router = useRouter();
  const ownerOptions = useMemo<UiSelectOption[]>(
    () => members.map((member) => ({ value: member.value, label: member.label })),
    [members]
  );
  const [metadata, setMetadata] = useState<MetadataDraft>(emptyMetadata);
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
      writeUploadMetadataDraft(organizationId, { ...metadata, tags: "" });
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
    const accepted: File[] = [];
    const seen = new Set(files.map(fileSelectionKey));
    let skippedType = 0;
    let skippedSize = 0;
    let duplicate = 0;

    for (const file of Array.from(newFiles)) {
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
    if (accepted.length > 0) messageParts.push(`${accepted.length} file${accepted.length === 1 ? "" : "s"} ready to upload.`);
    if (skippedType > 0) messageParts.push(`${skippedType} unsupported file${skippedType === 1 ? " was" : "s were"} skipped.`);
    if (skippedSize > 0) messageParts.push(`${skippedSize} file${skippedSize === 1 ? " exceeds" : "s exceed"} the ${CONTRACT_FILE_MAX_MB_LABEL} limit.`);
    if (duplicate > 0) messageParts.push(`${duplicate} duplicate file${duplicate === 1 ? " was" : "s were"} ignored.`);

    setSelectionNotice(accepted.length > 0 || skippedType > 0 || skippedSize > 0 || duplicate > 0 ? { accepted: accepted.length, duplicate, skippedType, skippedSize } : null);
    setFileNotice(messageParts.length > 0 ? messageParts.join(" ") : null);
    setUploadOutcome(null);
    setFiles((prev) => [...prev, ...accepted]);
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
    formData.set("sourceSystem", metadata.sourceSystem.trim());
    formData.set("externalReferenceId", metadata.externalReferenceId.trim());
    for (const file of files) formData.append("files", file);

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
      const summaryParts = [`${result.uploadSummary.uploadedFiles} file${result.uploadSummary.uploadedFiles === 1 ? "" : "s"} uploaded`];
      if (result.uploadSummary.skippedInvalidFiles > 0) summaryParts.push(`${result.uploadSummary.skippedInvalidFiles} invalid file${result.uploadSummary.skippedInvalidFiles === 1 ? "" : "s"} skipped`);
      if (result.uploadSummary.failedUploadFiles > 0) summaryParts.push(`${result.uploadSummary.failedUploadFiles} upload${result.uploadSummary.failedUploadFiles === 1 ? "" : "s"} failed`);
      if (result.extractionStatus === "queued") summaryParts.push("contract-detail suggestions queued");
      else if (result.extractionStatus === "not_available") summaryParts.push("contract-detail suggestions unavailable in this environment");
      setUploadOutcome(summaryParts.join(" - "));
      if (!pushAppHref(router, result.redirectTo)) {
        setError("The contract was created, but the detail page could not be opened automatically.");
      }
    });
  }

  const canSubmit = metadata.title.trim().length > 0;
  const titleInvalid = titleTouched && metadata.title.trim().length === 0;
  const fieldsDisabled = !!disabled || isPending;
  const submitLabel = files.length > 0 ? "Upload contract" : "Create contract record";
  const pendingLabel = files.length > 0 ? "Uploading contract file..." : "Creating contract record...";
  const pendingNotice =
    isPending && files.length > 0
      ? "Uploading the signed contract file and confirming which files stored. If any file fails, you will land on the contract record with recovery steps."
      : isPending
        ? "Creating the contract record. Attach a signed file later to prepare suggested details for review."
        : null;
  const actionBarLabel = disabled
    ? "Cannot create the record"
    : isPending
      ? files.length > 0
        ? "Uploading contract"
        : "Creating contract record"
      : !canSubmit
        ? "Add a contract name to continue"
        : files.length > 0
          ? "Ready to upload"
          : "Ready to create record";
  const actionBarTone: "neutral" | "ready" | "warning" = disabled ? "warning" : !canSubmit || isPending ? "neutral" : "ready";
  const actionBarReason = disabled ? disabledReason : !canSubmit ? "Enter a contract name to create the record." : undefined;
  const sourceFilesAccept = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="ui-card-raised overflow-hidden p-0"
    >
      <UploadFormNotices
        disabled={disabled}
        disabledReason={disabledReason}
        error={error}
        uploadOutcome={uploadOutcome}
        fileNotice={fileNotice}
        pendingNotice={pendingNotice}
        hydratedFromStorage={hydratedFromStorage}
        hasMeaningfulDraft={hasMeaningfulDraft}
      />
      <UploadSourceSection
        files={files}
        fieldsDisabled={fieldsDisabled}
        disabled={disabled}
        fileInputRef={fileInputRef}
        sourceFilesAccept={sourceFilesAccept}
        selectionNotice={selectionNotice}
        onFiles={handleFiles}
        onRemoveFile={removeFile}
      />
      <UploadDetailsSection
        metadata={metadata}
        setMetadata={setMetadata}
        ownerOptions={ownerOptions}
        fieldsDisabled={fieldsDisabled}
        titleInvalid={titleInvalid}
        setTitleTouched={setTitleTouched}
      />
      <UploadFormActionBar
        actionBarLabel={actionBarLabel}
        actionBarTone={actionBarTone}
        actionBarReason={actionBarReason}
        isPending={isPending}
        disabled={disabled}
        canSubmit={canSubmit}
        pendingLabel={pendingLabel}
        submitLabel={submitLabel}
      />
    </form>
  );
}
