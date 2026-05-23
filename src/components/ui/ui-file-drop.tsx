"use client";

import { useCallback, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { File as FileIcon, UploadCloud, X } from "lucide-react";

export interface UiFileDropProps {
  name: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  hint?: string;
  className?: string;
  onChange?: (files: FileList | null) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UiFileDrop({
  name,
  accept,
  multiple,
  required,
  disabled,
  ariaLabel,
  hint,
  className,
  onChange,
}: UiFileDropProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isOver, setIsOver] = useState(false);

  const setFromFileList = useCallback(
    (list: FileList | null) => {
      setFiles(list ? Array.from(list) : []);
      onChange?.(list);
    },
    [onChange]
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFromFileList(e.target.files);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files;
    if (inputRef.current) {
      inputRef.current.files = dropped;
    }
    setFromFileList(dropped);
  };

  const clearFiles = () => {
    if (inputRef.current) inputRef.current.value = "";
    setFromFileList(null);
  };

  return (
    <div className={className}>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
          disabled
            ? "cursor-not-allowed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,transparent)] opacity-60"
            : isOver
              ? "border-[color:color-mix(in_oklab,var(--accent)_60%,var(--border-strong))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))]"
              : "border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_38%,var(--surface-raised))] hover:border-[color:color-mix(in_oklab,var(--accent)_38%,var(--border-strong))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))]"
        }`}
        aria-label={ariaLabel}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          required={required}
          disabled={disabled}
          onChange={onInputChange}
          className="sr-only"
        />
        <UploadCloud
          className="h-6 w-6 text-[var(--text-tertiary)]"
          strokeWidth={1.65}
          aria-hidden
        />
        <p className="text-[12.5px] font-medium text-[var(--text-secondary)]">
          <span className="text-[var(--accent-strong)]">Click to browse</span> or drag and drop
        </p>
        {hint ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {hint}
          </p>
        ) : null}
      </label>

      {files.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1.5 text-[12.5px]"
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
                <FileIcon className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                <span className="min-w-0 truncate">{file.name}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-2">
                <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  onClick={clearFiles}
                  aria-label={`Remove ${file.name}`}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
