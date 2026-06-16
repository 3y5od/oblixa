import type { LucideIcon } from "lucide-react";
import { Calculator, CheckCircle2, CircleDashed, CircleHelp, Eye, History } from "lucide-react";

/**
 * §62 — the shared visual for a date/value's trust state across the dense Core
 * ledgers. One icon + label pair per state (never colour alone, §7.7 / §16) with
 * a self-describing hover hint, on a trust ladder where only a human-confirmed
 * value earns success green and everything unverified stays warning/neutral so a
 * calculated or suggested date never reads as trusted as a confirmed one.
 *
 * States map to the release-state "Data Confidence" vocabulary. Renewals supplies
 * its own spec-string `label`/`hint` so its copy stays authoritative; other
 * surfaces can rely on the canonical defaults below.
 */

export type DateProvenanceState =
  | "confirmed"
  | "suggested"
  | "calculated"
  | "missing"
  | "unknown"
  | "stale";

export type ProvenanceTone = "success" | "warning" | "muted" | "neutral" | "calculated";

/** The canonical label/icon/tone for each trust state. Exported as the single
 *  source of truth so other surfaces (e.g. the Reports date-state column) render
 *  an identical Confirmed/Suggested/Calculated/Missing treatment instead of a
 *  hand-tuned copy that drifts. */
export const PROVENANCE: Record<
  DateProvenanceState,
  { label: string; hint: string; icon: LucideIcon; tone: ProvenanceTone }
> = {
  confirmed: {
    label: "Confirmed",
    hint: "A person confirmed this date.",
    icon: CheckCircle2,
    tone: "success",
  },
  suggested: {
    label: "Suggested",
    hint: "Suggested from the document but not yet confirmed.",
    icon: Eye,
    tone: "warning",
  },
  calculated: {
    label: "Calculated",
    hint: "Derived from other dates — not directly confirmed.",
    icon: Calculator,
    // A derived value gets its own cool "calculated" register — distinct from
    // confirmed green and the warm source amber — so it never reads as confirmed.
    tone: "calculated",
  },
  missing: {
    label: "Missing",
    hint: "No date on file yet. Add or confirm one.",
    icon: CircleDashed,
    tone: "warning",
  },
  unknown: {
    label: "Unknown",
    hint: "Marked unknown.",
    icon: CircleHelp,
    tone: "neutral",
  },
  stale: {
    label: "Stale",
    hint: "The source changed since this was confirmed. Review again.",
    icon: History,
    tone: "warning",
  },
};

export function provenanceInk(tone: ProvenanceTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "calculated") return "var(--calculated-ink)";
  if (tone === "muted") return "color-mix(in oklab, var(--warning-ink) 68%, var(--text-tertiary))";
  return "var(--text-tertiary)";
}

export interface DateProvenanceBadgeProps {
  state: DateProvenanceState;
  /** Override the visible label (e.g. a surface's spec-string copy). */
  label?: string;
  /** Override the hover hint. */
  hint?: string;
  /** Optional accessible prefix so a screen reader hears "Renewal date: Confirmed". */
  srPrefix?: string;
  className?: string;
}

export function DateProvenanceBadge({
  state,
  label,
  hint,
  srPrefix,
  className,
}: DateProvenanceBadgeProps) {
  const meta = PROVENANCE[state];
  const Icon = meta.icon;
  const visibleLabel = label ?? meta.label;
  const title = hint ?? meta.hint;
  return (
    <span
      className={`ui-caps-3 inline-flex items-center gap-1 text-[10.5px] leading-none ${className ?? ""}`.trim()}
      style={{ color: provenanceInk(meta.tone) }}
      title={title}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {srPrefix ? <span className="sr-only">{srPrefix}: </span> : null}
      {visibleLabel}
    </span>
  );
}
