import { FileText, X } from "lucide-react";
import { formatFileSize } from "@/lib/format-file-size";

export interface SelectedFileListProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function fileTypeLabel(type: string): string {
  return type === "application/pdf" ? "PDF" : "DOCX";
}

/**
 * Structured rows for the files staged for upload: icon + filename + type chip +
 * size + a stable-hit-area remove button. Lifts the staged files out of the
 * dropzone so they read as a confirmed selection, not dropzone chrome.
 */
export function SelectedFileList({ files, onRemove, disabled }: SelectedFileListProps) {
  if (files.length === 0) return null;
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] overflow-hidden rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--surface-raised))]">
      {files.map((file, i) => (
        <li
          key={`${file.name}-${i}`}
          className="flex items-center gap-2.5 px-3 py-2.5"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)]"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.85} />
          </span>
          <span
            title={file.name}
            className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]"
          >
            {file.name}
          </span>
          <span className="ui-caps-3 hidden shrink-0 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9.5px] leading-none text-[var(--text-tertiary)] sm:inline-flex">
            {fileTypeLabel(file.type)}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
            {formatFileSize(file.size)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            disabled={disabled}
            className="ui-icon-button inline-flex h-7 w-7 min-h-7 min-w-7 shrink-0 items-center justify-center border-transparent bg-transparent p-0 text-[var(--text-tertiary)] shadow-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-ink)_12%,transparent)] hover:text-[var(--danger-ink)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Remove ${file.name} from list`}
          >
            <X className="h-4 w-4" strokeWidth={1.85} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
