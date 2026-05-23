import type { StatTone } from "@/components/ui/stat-cell";
import {
  formatCalendarCompact,
  formatRelativeCompact,
  formatRelativeReadable,
} from "@/lib/ui-copy";

export interface TimeChipProps {
  date: Date | string | null | undefined;
  /** `relative` (default) → 4D / 2H / NOW caps abbreviation;
   *  `readable` → 16 min / 2 hr / 4 d sentence-case;
   *  `calendar` → MAY 9 absolute. */
  format?: "relative" | "readable" | "calendar";
  tone?: StatTone;
  className?: string;
  /** Optional title attribute override. Defaults to ISO timestamp. */
  title?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-tertiary)";
}

/**
 * Compact caps-tracking time chip. Replaces prose like "4 days ago".
 */
export function TimeChip({
  date,
  format = "relative",
  tone,
  className,
  title,
}: TimeChipProps) {
  if (!date) return null;
  const value =
    format === "calendar"
      ? formatCalendarCompact(date)
      : format === "readable"
        ? formatRelativeReadable(date)
        : formatRelativeCompact(date);
  const d = date instanceof Date ? date : new Date(date);
  const titleAttr =
    title ?? (Number.isFinite(d.getTime()) ? d.toISOString() : undefined);
  return (
    <span
      title={titleAttr}
      aria-label={
        title ??
        (Number.isFinite(d.getTime())
          ? d.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : undefined)
      }
      className={`inline-flex items-center text-[11px] font-medium leading-none tabular-nums ${
        tone
          ? `rounded-md border px-1.5 py-0.5 ${format === "readable" ? "" : "uppercase tracking-[0.12em]"}`
          : ""
      } ${className ?? ""}`.trim()}
      style={
        tone
          ? {
              color: toneInk(tone),
              borderColor: `color-mix(in oklab, ${toneInk(tone)} 28%, var(--border-card))`,
              background: `color-mix(in oklab, ${toneInk(tone)} 10%, transparent)`,
            }
          : { color: toneInk(tone) }
      }
    >
      {value}
    </span>
  );
}
