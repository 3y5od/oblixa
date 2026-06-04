import type { StatTone } from "@/components/ui/stat-cell";

export interface FieldChipProps {
  /** Caps identifier shown in the chip (e.g. "RENEWAL DATE"). Uppercased via CSS. */
  label: string;
  tone?: StatTone;
  /** `solid` (default) for present identifiers; `dashed` for "+N more" overflow markers. */
  variant?: "solid" | "dashed";
  /** Hover tooltip — defaults to the label. */
  title?: string;
  "aria-label"?: string;
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-secondary)";
}

/**
 * Bordered caps chip for a single field / entity identifier. Consolidates the
 * inline span constructions that previously appeared in Data Gaps, the Review
 * Queue, and work-row contract references so the dashboard's identifier-chip
 * vocabulary stays bounded (one primitive, one look). Tone tints the
 * border/bg/text; `dashed` is the quiet overflow variant.
 */
export function FieldChip({
  label,
  tone,
  variant = "solid",
  title,
  className,
  ...rest
}: FieldChipProps) {
  const ink = toneInk(tone);
  const ariaLabel = rest["aria-label"];
  return (
    <span
      title={title ?? label}
      aria-label={ariaLabel}
      className={`inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none ${
        variant === "dashed" ? "border-dashed" : ""
      } ${className ?? ""}`.trim()}
      style={{
        // Untoned chips drop to a soft hairline + flat recessed fill so a row
        // of identifier chips reads as quiet tags rather than a stack of
        // competing outlines; toned chips keep their status-tinted border as a
        // real signal.
        borderColor: tone
          ? `color-mix(in oklab, ${ink} 28%, var(--border-card))`
          : "color-mix(in oklab, var(--border-subtle) 55%, transparent)",
        background: tone
          ? `color-mix(in oklab, ${ink} 10%, var(--surface-raised))`
          : "color-mix(in oklab, var(--surface-muted) 55%, var(--surface))",
        color: variant === "dashed" && !tone ? "var(--text-tertiary)" : ink,
      }}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
