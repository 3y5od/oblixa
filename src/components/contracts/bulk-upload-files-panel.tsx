import type { RefObject } from "react";
import { ConstraintBand } from "@/components/contracts/constraint-band";
import { CreationPipeline } from "@/components/contracts/creation-pipeline";
import { Dropzone } from "@/components/contracts/dropzone";
import { SelectedFileList } from "@/components/contracts/selected-file-list";
import { UploadTrustNote } from "@/components/contracts/upload-trust-note";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { RatioChip } from "@/components/ui/ratio-chip";
import { CONTRACT_FILE_MAX_MB_LABEL } from "@/lib/constants/upload-limits";
import { formatFileSize } from "@/lib/format-file-size";
import { FILE_STEPS, MAX_FILES, SIGNED_FILES_ACCEPT } from "./bulk-upload-form-types";

export function BulkUploadFilesPanel({
  signedFilesInputRef,
  disabled,
  isPending,
  sourceFiles,
  sourceFileBytes,
  fileRejections,
  onFiles,
  onRemoveFile,
}: {
  signedFilesInputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  isPending: boolean;
  sourceFiles: File[];
  sourceFileBytes: number;
  fileRejections: string[];
  onFiles: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
}) {
  return (
    <div role="tabpanel" id="import-panel-files" aria-labelledby="import-tab-files" className="space-y-5 px-5 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">Signed PDF or DOCX files</p>
        </div>
        <div className="mt-2">
          <Dropzone
            inputRef={signedFilesInputRef}
            inputId="signed-files-input"
            name="files"
            accept={SIGNED_FILES_ACCEPT}
            multiple
            ariaLabel="Signed PDF or DOCX files"
            primaryText={
              <>
                <span className="text-[var(--accent-strong)]">Choose signed contract files</span> or drag them here
              </>
            }
            formats={["PDF", "DOCX"]}
            hint={`up to 12 files, ${CONTRACT_FILE_MAX_MB_LABEL} each`}
            note="one file per contract"
            disabled={disabled || isPending}
            onFiles={onFiles}
          />
        </div>
        <div className="mt-3">
          <ConstraintBand
            items={[
              { label: "Per import", value: "Up to 12 files" },
              { label: "Max size", value: `${CONTRACT_FILE_MAX_MB_LABEL} each` },
              { label: "Mapping", value: "One file creates one contract record" },
            ]}
          />
        </div>
        <div className="mt-3">
          <UploadTrustNote />
        </div>
        {sourceFiles.length > 0 ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <RatioChip numerator={sourceFiles.length} denominator={MAX_FILES} suffix="files" />
              <KeyValueChip label="Total" value={formatFileSize(sourceFileBytes)} />
            </div>
            <SelectedFileList files={sourceFiles} onRemove={onRemoveFile} disabled={disabled || isPending} />
          </div>
        ) : null}
        {fileRejections.length > 0 ? <FileRejections rejections={fileRejections} /> : null}
      </div>
      <CreationPipeline heading="What happens next" steps={FILE_STEPS.map((label) => ({ label }))} layout="compact" />
    </div>
  );
}

function FileRejections({ rejections }: { rejections: string[] }) {
  return (
    <div className="ui-alert-warning mt-2 text-[12px]" role="status">
      <p className="text-[12px] font-semibold">Some files need correction</p>
      <div className="mt-1 space-y-0.5">
        {rejections.map((rejection) => (
          <p key={rejection}>{rejection}</p>
        ))}
      </div>
    </div>
  );
}
