import { ChevronRight, FileText, FolderOpen } from "lucide-react";
import { ContractPanelHeader } from "./contract-panel-header";
import { UploadMoreFiles } from "./upload-more-files";
import { DownloadButton } from "./download-button";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { TimeChip } from "@/components/ui/time-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { UiSelect } from "@/components/ui/ui-select";
import { formatFileSize } from "@/lib/format-file-size";
import { supersedeContractFileForm } from "@/actions/contracts";

type SourceFile = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  superseded_at: string | null;
};

/**
 * Core "Source documents" panel body. The section title is passed by the route
 * (its copy is owned + pinned there). Empty state uses DashboardEmptyState;
 * "Replace source document" is a quiet impact disclosure that supersedes the
 * prior file and asks for fresh suggestions.
 */
export function ContractSourceDocuments({
  title,
  contractId,
  files,
  filesCount,
  hasSourceFiles,
  canEdit,
}: {
  title: string;
  contractId: string;
  files: SourceFile[];
  filesCount: number;
  hasSourceFiles: boolean;
  canEdit: boolean;
}) {
  const replaceable = files.filter((f) => !f.superseded_at);
  return (
    <section
      id="source-documents"
      className={`${hasSourceFiles ? "ui-card-quiet" : "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]"} scroll-mt-28 overflow-hidden`}
    >
      <ContractPanelHeader
        icon={FolderOpen}
        eyebrow="Files"
        title={title}
        count={filesCount}
        countLabel="files"
        action={<UploadMoreFiles contractId={contractId} canEdit={canEdit} className="" />}
      />
      {files.length ? (
        <div className="px-5 py-3 sm:px-6">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="ui-icon-tile-compact shrink-0" aria-hidden>
                    <FileText className="h-4 w-4" strokeWidth={1.85} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{file.file_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <KeyValueChip label="Size" value={formatFileSize(file.file_size)} />
                      <TimeChip date={file.created_at} format="calendar" bordered />
                      {file.superseded_at ? (
                        <StatusBadge status="disabled">Superseded</StatusBadge>
                      ) : (
                        <StatusBadge status="healthy">Stored</StatusBadge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 justify-end">
                  <DownloadButton storagePath={file.storage_path} fileName={file.file_name} />
                </div>
              </li>
            ))}
          </ul>
          {canEdit && replaceable.length > 0 ? (
            <details className="group/replace mt-5 border-t border-[var(--border-subtle)] pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md text-[11.5px] font-medium text-[var(--text-tertiary)] outline-none transition-colors marker:hidden hover:text-[var(--warning-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="h-3 w-3 transition-transform group-open/replace:rotate-90"
                  strokeWidth={2}
                  aria-hidden
                />
                Replace source document
              </summary>
              <form action={supersedeContractFileForm} className="mt-3 grid gap-2">
                <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
                  The selected file is kept as superseded and Oblixa suggests details from the new upload.
                </p>
                <input type="hidden" name="contractId" value={contractId} />
                <UiSelect
                  name="fileId"
                  required
                  portal
                  ariaLabel="File to replace"
                  placeholder="Select a file to replace"
                  className="w-full"
                  options={replaceable.map((f) => ({ value: f.id, label: f.file_name }))}
                />
                <input
                  aria-label="Reason (optional)"
                  name="reason"
                  maxLength={200}
                  placeholder="Reason (optional)"
                  className="ui-input text-xs"
                />
                <button type="submit" className="ui-btn-secondary max-w-max px-3 py-2 text-xs">
                  Replace file and refresh suggestions
                </button>
              </form>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="px-5 py-4 sm:px-6">
          <DashboardEmptyState
            icon={FolderOpen}
            label="No source files yet"
            hint="Upload a signed PDF or DOCX so Oblixa can suggest details"
          />
        </div>
      )}
    </section>
  );
}
