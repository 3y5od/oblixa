import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StatTone } from "@/components/ui/stat-cell";

export interface ChipCapsuleProps {
  /** Caps label on the left segment (e.g., "EXCEPTIONS"). */
  leftLabel: string;
  /** Tabular value rendered before the left label (e.g., 2). */
  leftValue: string | number;
  /** Caps verb on the right segment (e.g., "TRIAGE"). */
  rightVerb: string;
  href: string;
  tone?: StatTone;
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--text-secondary)";
}

/**
 * Single bordered capsule with two visually-bound segments. Communicates a
 * cause-and-effect pair (count + action) inside one tactile unit so the eye
 * reads them together rather than as siblings.
 *
 *   ┌─────────────────────┬──────────────┐
 *   │ 2 EXCEPTIONS        │ TRIAGE →     │
 *   └─────────────────────┴──────────────┘
 *
 * Left segment carries the inventory (subtle tinted bg). Right segment is the
 * primary affordance (saturated bg + hover state).
 */
export function ChipCapsule({
  leftLabel,
  leftValue,
  rightVerb,
  href,
  tone,
  className,
}: ChipCapsuleProps) {
  const ink = toneInk(tone);
  return (
    <Link
      href={href}
      className={`ui-chip-focus group inline-flex items-stretch overflow-hidden rounded-full border transition-all hover:brightness-105 ${className ?? ""}`.trim()}
      style={{
        borderColor: `color-mix(in oklab, ${ink} 36%, var(--border-card))`,
      }}
    >
      {/* Left segment — count + label, subdued. items-baseline keeps the
         tabular digit visually aligned with the caps token. */}
      <span
        className="inline-flex items-baseline gap-1 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none"
        style={{
          color: ink,
          background: `color-mix(in oklab, ${ink} 8%, var(--surface-raised))`,
        }}
      >
        <span className="tabular-nums leading-none">{leftValue}</span>
        <span className="leading-none">{leftLabel.toUpperCase()}</span>
      </span>
      {/* Internal hairline divider */}
      <span
        aria-hidden
        className="w-px self-stretch"
        style={{ background: `color-mix(in oklab, ${ink} 55%, var(--border-card))` }}
      />
      {/* Right segment — primary action. Tighter left-padding so the arrow
         doesn't push the verb away from the divider. */}
      <span
        className="inline-flex items-baseline gap-1 pl-2 pr-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] leading-none transition-colors group-hover:brightness-115"
        style={{
          color: ink,
          background: `color-mix(in oklab, ${ink} 16%, var(--surface-raised))`,
        }}
      >
        <span className="leading-none">{rightVerb.toUpperCase()}</span>
        <ArrowRight
          className="h-3 w-3 shrink-0 self-center transition-transform group-hover:translate-x-1"
          strokeWidth={1.85}
          aria-hidden
        />
      </span>
    </Link>
  );
}
