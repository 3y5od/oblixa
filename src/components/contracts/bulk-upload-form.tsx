"use client";

import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { bulkCreateContractsFromFiles } from "@/actions/contracts";
import { CONTRACT_FILE_MAX_MB_LABEL } from "@/lib/constants/upload-limits";
import { describeRecoverableMutationError } from "@/lib/recoverable-mutation-error";
import { BulkUploadActionBar } from "./bulk-upload-action-bar";
import { BulkUploadCsvPanel } from "./bulk-upload-csv-panel";
import { BulkUploadFilesPanel } from "./bulk-upload-files-panel";
import {
  IMPORT_METHODS,
  MAX_FILE_BYTES,
  MAX_FILES,
  type BulkUploadFormProps,
  type CsvCheck,
  type ImportApiBody,
  type ImportPath,
  type ImportResult,
} from "./bulk-upload-form-types";
import {
  importErrorMessage,
  inspectCsv,
  isCsvFile,
  isFile,
  isPdfOrDocx,
} from "./bulk-upload-form-utils";
import { BulkUploadDisabledBanner, BulkUploadResultRegion } from "./bulk-upload-result-region";
import { BulkUploadTabs } from "./bulk-upload-tabs";

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
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", path === "files" ? "signed" : "csv");
      window.history.replaceState(null, "", url.toString());
    } catch {
      // URL/history can be unavailable in non-browser test contexts.
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
      rejected.push(`Up to ${MAX_FILES} files per import - extra files were skipped`);
    }
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
        await submitCsvImport(form, fd);
        return;
      }
      await submitSignedFileImport(form, fd);
    });
  }

  async function submitCsvImport(form: HTMLFormElement, fd: FormData) {
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
            ? "Import started. Oblixa is checking rows and creating contract records. You can leave this page and open the import result when it finishes."
            : `CSV import created ${created} contract${created === 1 ? "" : "s"} for review.`,
        jobId: body.jobId ?? body.v10?.changed_object_id ?? null,
      });
      form.reset();
      clearCsv();
      router.refresh();
    } catch {
      setResult({ type: "error", text: "Could not read or upload the CSV file. Try again." });
    }
  }

  async function submitSignedFileImport(form: HTMLFormElement, fd: FormData) {
    const uploadData = new FormData();
    uploadData.append("organizationId", organizationId);
    for (const file of sourceFiles) uploadData.append("files", file);

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
  const submitLabel = activePath === "csv" ? "Import tracker rows" : "Upload signed files";
  const hasCsvIssue = activePath === "csv" && csvFile != null && !!csvIssue;
  const barTone: "neutral" | "ready" | "warning" = ready
    ? "ready"
    : hasCsvIssue
      ? "warning"
      : "neutral";
  const barLabel = ready
    ? "Ready to import"
    : activePath === "csv"
      ? csvFile
        ? "Fix CSV before import"
        : "No CSV selected"
      : "No files selected";
  const disabledReasonLine =
    disabled || ready
      ? undefined
      : activePath === "csv"
        ? csvFile
          ? "Correct the highlighted columns or file size, then import again."
          : "Choose a tracker CSV before importing contract records."
        : "Choose signed PDF or DOCX files before importing.";

  return (
    <form className="ui-card-raised overflow-hidden p-0" onSubmit={handleSubmit}>
      <BulkUploadTabs activePath={activePath} tabRefs={tabRefs} onSelect={selectTab} onKeyDown={onTabKeyDown} />
      <BulkUploadDisabledBanner disabledReason={disabledReason} />
      <BulkUploadResultRegion
        result={result}
        activePath={activePath}
        onImportAnotherCsv={() => {
          setResult(null);
          clearCsv();
          csvInputRef.current?.focus();
        }}
      />
      {activePath === "csv" ? (
        <BulkUploadCsvPanel
          csvInputRef={csvInputRef}
          disabled={disabled}
          isPending={isPending}
          csvFile={csvFile}
          csvCheck={csvCheck}
          csvIssue={csvIssue}
          csvError={csvError}
          onFiles={handleCsvFiles}
          onClearCsv={clearCsv}
        />
      ) : (
        <BulkUploadFilesPanel
          signedFilesInputRef={signedFilesInputRef}
          disabled={disabled}
          isPending={isPending}
          sourceFiles={sourceFiles}
          sourceFileBytes={sourceFileBytes}
          fileRejections={fileRejections}
          onFiles={handleSignedFiles}
          onRemoveFile={removeSignedFile}
        />
      )}
      <BulkUploadActionBar
        activePath={activePath}
        canSubmit={canSubmit}
        showPrimary={showPrimary}
        barLabel={barLabel}
        barTone={barTone}
        disabledReasonLine={disabledReasonLine}
        isPending={isPending}
        submitLabel={submitLabel}
      />
    </form>
  );
}
