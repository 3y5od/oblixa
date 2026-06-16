"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { Plus, UploadCloud } from "lucide-react";
import { MetaChip } from "@/components/ui/meta-chip";

export interface DropzoneProps {
  inputRef: RefObject<HTMLInputElement | null>;
  inputId: string;
  /** Form field name — set when a form reads the file from FormData (CSV path). */
  name?: string;
  accept: string;
  multiple?: boolean;
  /** Accessible name for the file input — resolves label-driven test queries
   *  (`getByLabelText`) and the screen-reader name. */
  ariaLabel: string;
  /** Primary line inside the full dropzone. ReactNode so callers can accent the
   *  action word (e.g. "…or <span class=accent>browse</span>"). */
  primaryText?: ReactNode;
  /** Format pills shown under the primary text (e.g. ["PDF", "DOCX"]). */
  formats?: string[];
  /** Trailing caps hint after the format pills (e.g. "up to 12 files, 20 MB each"). */
  hint?: string;
  /** Optional second caption chip (e.g. "one file per contract"). */
  note?: string;
  disabled?: boolean;
  onFiles: (files: FileList | null) => void;
  /** "full" is the empty-state hero dropzone; "compact" is the slim
   *  "add another" row shown once files are staged. */
  variant?: "full" | "compact";
  /** Compact-variant label. */
  compactLabel?: string;
  /** "md" (default) is the hero empty-state height; "sm" is a shorter variant
   *  for dense forms (e.g. /contracts/new) so the dropzone doesn't dominate. */
  size?: "md" | "sm";
  className?: string;
}

/**
 * One dropzone for every contract intake surface (single upload + bulk import).
 * A `<label>` wraps a visually-hidden file input, so the whole target opens the
 * picker natively — one tab stop, native Space/Enter — while drag-and-drop is
 * handled on the label. The input keeps its `aria-label` so label-driven test
 * queries and assistive tech resolve the control. Reset/append semantics stay
 * with the owning form (the dropzone never mutates the input value).
 */
export function Dropzone({
  inputRef,
  inputId,
  name,
  accept,
  multiple,
  ariaLabel,
  primaryText,
  formats,
  hint,
  note,
  disabled,
  onFiles,
  variant = "full",
  compactLabel = "Add another file",
  size = "md",
  className,
}: DropzoneProps) {
  const [isOver, setIsOver] = useState(false);

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      name={name}
      type="file"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onFiles(e.currentTarget.files)}
      className="sr-only"
    />
  );

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files;
      // Keep the native input in sync so forms that read the file from FormData
      // (the CSV import path) still see a dropped file. Best-effort: `.files` is
      // read-only in some environments — the FileList still flows via onFiles.
      try {
        if (inputRef.current) inputRef.current.files = dropped;
      } catch {
        /* unsupported assignment — onFiles already carries the FileList */
      }
      onFiles(dropped);
    },
  };

  if (variant === "compact") {
    return (
      <label
        {...dragProps}
        className={`flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-[12.5px] font-medium outline-none transition-[border-color,background-color] duration-[var(--ui-duration)] ease-[var(--ui-ease-out)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${
          disabled
            ? "cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-tertiary)] opacity-60"
            : "cursor-pointer border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--border-strong))] hover:text-[var(--accent-strong)]"
        } ${className ?? ""}`.trim()}
      >
        {input}
        <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {compactLabel}
      </label>
    );
  }

  // The full variant is a "source-document well": source-paper ground, a thin
  // SOLID frame (not the heavy generic border-2 dashed), and a subtle inner
  // dashed hairline that retains the drop affordance. A quiet document-margin
  // rule near the left edge reads it as a document zone (§7 document-margin
  // motif). Drag-over swaps the frame to accent + a faint accent-soft wash.
  const wellCls = disabled
    ? "cursor-not-allowed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-inset)_60%,var(--surface-raised))] opacity-60"
    : isOver
      ? "cursor-pointer border-[var(--accent-strong)] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-inset))]"
      : "ui-surface-source cursor-pointer border-[var(--border-subtle)] hover:border-[color:color-mix(in_oklab,var(--accent)_38%,var(--border-strong))]";
  // Inner dashed hairline frame — inset from the solid frame so the affordance
  // reads without the generic full-border dashed look.
  const innerCls = disabled
    ? "border-[var(--border-subtle)]"
    : isOver
      ? "border-[color:color-mix(in_oklab,var(--accent)_50%,var(--border-subtle))]"
      : "border-[color:color-mix(in_oklab,var(--border-strong)_30%,var(--border-subtle))]";
  const padCls = size === "sm" ? "px-5 py-5" : "px-5 py-6 sm:py-7";
  const gapCls = size === "sm" ? "gap-2.5" : "gap-3";

  return (
    <label
      {...dragProps}
      className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-lg border text-center outline-none transition-[border-color,background-color] duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${padCls} ${gapCls} ${wellCls} ${className ?? ""}`.trim()}
    >
      {input}
      {/* Document-margin rule near the left edge — reads as a document zone. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-3.5 w-px bg-[color:color-mix(in_oklab,var(--border-strong)_55%,transparent)]"
      />
      {/* Inner dashed hairline retains the drop affordance without a heavy border. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-2 rounded-md border border-dashed transition-colors duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] ${innerCls}`}
      />
      <span
        aria-hidden
        className={`relative inline-flex shrink-0 items-center justify-center text-[var(--text-tertiary)] transition-colors duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] ${
          isOver && !disabled ? "text-[var(--accent-strong)]" : "group-hover:text-[var(--text-secondary)]"
        }`}
      >
        <UploadCloud className={size === "sm" ? "h-7 w-7" : "h-8 w-8"} strokeWidth={1.5} />
      </span>
      <div className="relative">
        {primaryText ? (
          <p
            className={`font-semibold text-[var(--text-primary)] ${size === "sm" ? "text-[13px]" : "text-[14px]"}`}
          >
            {primaryText}
          </p>
        ) : null}
        {formats?.length || hint ? (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {formats?.map((f) => <MetaChip key={f}>{f}</MetaChip>)}
            {hint ? (
              <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">
                {hint}
              </span>
            ) : null}
          </div>
        ) : null}
        {note ? (
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
            {note}
          </p>
        ) : null}
      </div>
    </label>
  );
}
