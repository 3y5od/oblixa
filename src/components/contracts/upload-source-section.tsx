import type { RefObject } from "react";
import { FileUp } from "lucide-react";
import { ConstraintBand } from "@/components/contracts/constraint-band";
import { Dropzone } from "@/components/contracts/dropzone";
import { SelectedFileList } from "@/components/contracts/selected-file-list";
import { UploadSection } from "@/components/contracts/upload-section";
import { UploadTrustNote } from "@/components/contracts/upload-trust-note";
import { MetaChip } from "@/components/ui/meta-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { CONTRACT_FILE_MAX_MB_LABEL } from "@/lib/constants/upload-limits";
import type { FileSelectionNotice } from "./upload-form-types";

export function UploadSourceSection({
  files,
  fieldsDisabled,
  disabled,
  fileInputRef,
  sourceFilesAccept,
  selectionNotice,
  onFiles,
  onRemoveFile,
}: {
  files: File[];
  fieldsDisabled: boolean;
  disabled?: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  sourceFilesAccept: string;
  selectionNotice: FileSelectionNotice | null;
  onFiles: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
}) {
  return (
    <UploadSection
      step={1}
      first
      icon={FileUp}
      title="Source document"
      lead="Upload the signed agreement, or create the record now and attach a file later. Suggested details require a source document."
      aside={
        files.length > 0 ? (
          <StatusBadge status="healthy">
            <span aria-hidden className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--success-ink)" }} />
            {files.length === 1 ? "1 file attached" : `${files.length} files attached`}
          </StatusBadge>
        ) : (
          <StatusBadge status="empty">
            <span aria-hidden className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "var(--border-strong)" }} />
            File can be added later
          </StatusBadge>
        )
      }
    >
      <ConstraintBand
        className="mb-3"
        items={[
          { label: "Accepted files", value: "PDF, DOCX" },
          { label: "Maximum size", value: CONTRACT_FILE_MAX_MB_LABEL, hint: "per file" },
          { label: "Review", value: "Required before a detail is trusted" },
        ]}
      />
      <div className="space-y-3">
        {files.length > 0 ? <SelectedFileList files={files} onRemove={onRemoveFile} disabled={fieldsDisabled} /> : null}
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
              Drop a signed PDF or DOCX here, or <span className="text-[var(--accent-strong)]">choose files</span>
            </>
          }
          formats={["PDF", "DOCX"]}
          hint={`Maximum ${CONTRACT_FILE_MAX_MB_LABEL}`}
          disabled={disabled}
          onFiles={onFiles}
        />
      </div>
      {selectionNotice ? <UploadSelectionNotice notice={selectionNotice} /> : null}
      <p className="mt-3 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
        After upload, Oblixa suggests dates, owners, and requirements from the document text. Suggested details need
        confirmation before they appear in reminders, tasks, reports, or search.{" "}
        <span className="text-[var(--text-secondary)]">Suggested details require a source document.</span>{" "}
        A record can be created without a file, but source-backed suggestions need a source document.
      </p>
      <div className="mt-3">
        <UploadTrustNote label="Workspace file handling" />
      </div>
    </UploadSection>
  );
}

function UploadSelectionNotice({ notice }: { notice: FileSelectionNotice }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {notice.accepted > 0 ? <MetaChip tone="success">{notice.accepted} accepted</MetaChip> : null}
      {notice.duplicate > 0 ? <MetaChip tone="warning">{notice.duplicate} duplicate</MetaChip> : null}
      {notice.skippedType > 0 ? <MetaChip tone="danger">{notice.skippedType} unsupported</MetaChip> : null}
      {notice.skippedSize > 0 ? <MetaChip tone="danger">{notice.skippedSize} over size limit</MetaChip> : null}
    </div>
  );
}
