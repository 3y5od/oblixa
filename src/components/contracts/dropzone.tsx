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
        className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-[12.5px] font-medium outline-none transition-[border-color,background-color] duration-[var(--ui-duration)] ease-[var(--ui-ease-out)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${
          disabled
            ? "cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-tertiary)] opacity-60"
            : "cursor-pointer border-[color:color-mix(in_oklab,var(--border-strong)_42%,var(--border-subtle))] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--border-strong))] hover:text-[var(--accent-strong)]"
        } ${className ?? ""}`.trim()}
      >
        {input}
        <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {compactLabel}
      </label>
    );
  }

  const stateCls = disabled
    ? "cursor-not-allowed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,transparent)] opacity-60"
    : isOver
      ? "cursor-pointer border-[var(--accent-strong)] bg-[color:color-mix(in_oklab,var(--accent-soft)_44%,transparent)] shadow-[var(--shadow-glow)] ring-2 ring-[color:color-mix(in_oklab,var(--accent)_28%,transparent)]"
      : "cursor-pointer border-[color:color-mix(in_oklab,var(--border-subtle)_90%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,var(--surface-raised))] hover:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-strong))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_16%,var(--surface-raised))]";
  const padCls = size === "sm" ? "px-5 py-5" : "px-5 py-6 sm:py-7";
  const gapCls = size === "sm" ? "gap-2.5" : "gap-3";

  return (
    <label
      {...dragProps}
      className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center outline-none transition-[border-color,background-color,box-shadow] duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${padCls} ${gapCls} ${stateCls} ${className ?? ""}`.trim()}
    >
      {input}
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)] transition-transform duration-[var(--ui-duration-slow)] ease-[var(--ui-ease-out)] group-hover:scale-[1.04] ${size === "sm" ? "h-10 w-10" : "h-11 w-11"}`}
      >
        <UploadCloud className={size === "sm" ? "h-[1.125rem] w-[1.125rem]" : "h-5 w-5"} strokeWidth={1.85} />
      </span>
      <div>
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
              <span className="ui-caps-3 text-[10px] tabular-nums text-[var(--text-tertiary)]">
                {hint}
              </span>
            ) : null}
          </div>
        ) : null}
        {note ? (
          <p className="ui-caps-3 mt-1.5 text-[9.5px] leading-none text-[var(--text-tertiary)]">
            {note}
          </p>
        ) : null}
      </div>
    </label>
  );
}
