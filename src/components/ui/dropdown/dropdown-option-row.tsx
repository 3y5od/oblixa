"use client";

import { Check, FileX, Paperclip } from "lucide-react";
import type { DropdownOptionIcon, DropdownStatusTone } from "./types";

/**
 * The one option-row layout for every listbox dropdown. Renders the inner
 * children of an option `<button>` (the button itself — role/aria/handlers and
 * the selected/hover surface — is owned by `DropdownListbox`).
 *
 * Canonical anatomy (mirrors the §7.3 RoleDropdown, now shared everywhere):
 * - A reserved LEFT check slot (§10.9) — always occupies width, glyph only when
 *   selected. This replaces the old far-right check that left selection reading
 *   as a "stranded tick" at the row edge.
 * - Optional leading status dot (§2.5) for rows that convey real state.
 * - Label, with an optional secondary description line.
 * - Optional trailing tabular count.
 */

const DOT_TONE: Record<DropdownStatusTone, { ink: string; halo: string }> = {
  success: { ink: "var(--success-ink)", halo: "var(--success-soft)" },
  warning: { ink: "var(--warning-ink)", halo: "var(--warning-soft)" },
  danger: { ink: "var(--danger-ink)", halo: "var(--danger-soft)" },
  neutral: { ink: "var(--border-strong)", halo: "transparent" },
};

export interface DropdownOptionRowProps {
  selected: boolean;
  label: string;
  description?: string;
  count?: number | string;
  statusDot?: DropdownStatusTone;
  icon?: DropdownOptionIcon;
}

export function DropdownOptionRow({
  selected,
  label,
  description,
  count,
  statusDot,
  icon,
}: DropdownOptionRowProps) {
  return (
    <>
      <span
        aria-hidden
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
      >
        {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : null}
      </span>
      {statusDot ? (
        <span
          aria-hidden
          className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: DOT_TONE[statusDot].ink,
            boxShadow:
              statusDot === "neutral"
                ? undefined
                : `0 0 0 3px color-mix(in oklab, ${DOT_TONE[statusDot].halo} 42%, transparent)`,
          }}
        />
      ) : null}
      {icon ? (
        <span
          aria-hidden
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--text-tertiary)]"
        >
          {icon === "paperclip" ? (
            <Paperclip className="h-3.5 w-3.5" strokeWidth={1.85} />
          ) : (
            <FileX className="h-3.5 w-3.5" strokeWidth={1.85} />
          )}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate leading-tight">{label}</span>
        {description ? (
          <span className="truncate text-[11px] leading-tight text-[var(--text-tertiary)]">
            {description}
          </span>
        ) : null}
      </span>
      {count != null ? (
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--text-tertiary)]">
          {count}
        </span>
      ) : null}
    </>
  );
}
