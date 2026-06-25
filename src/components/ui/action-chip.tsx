import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import type { StatTone } from "@/components/ui/stat-cell";

export interface ActionChipProps {
  /** Caps verb shown in the chip (e.g., "TRIAGE"). */
  verb: string;
  href: string;
  tone?: StatTone;
  icon?: LucideIcon;
  /** Ghost treatment — no fill or border, muted text that warms to accent on
   *  hover. Used for subordinate section actions so they don't compete with the
   *  primary CTA and the operational risk states (§8/§10 color discipline). */
  quiet?: boolean;
  className?: string;
}

function toneInk(tone?: StatTone): string {
  if (tone === "success") return "var(--success-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  if (tone === "danger") return "var(--danger-ink)";
  return "var(--accent-strong)";
}

/**
 * Sentence-case verb pill with a trailing arrow.
 *
 * v11 visual pass: dropped caps tracking — when every section action,
 * status pill, ratio chip, and disclosure label used caps, caps stopped
 * carrying hierarchy. ActionChip now reads as a structured ghost link:
 * sentence case, font-semibold, accent-ink at full saturation, chunkier
 * arrow that translates on hover. The chip surface is still tone-tintable
 * but the default is a quiet ghost so section actions stop whispering.
 */
export function ActionChip({
  verb,
  href,
  tone,
  icon: Icon,
  quiet,
  className,
}: ActionChipProps) {
  const ink = toneInk(tone);
  if (quiet) {
    return (
      <Link
        href={href}
        className={`ui-chip-focus group inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-[12.5px] font-semibold leading-none text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)] ${className ?? ""}`.trim()}
      >
        {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden /> : null}
        <span>{verb}</span>
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          strokeWidth={2}
          aria-hidden
        />
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`ui-chip-focus group inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-1 text-[12.5px] font-semibold leading-none transition-colors hover:brightness-110 ${className ?? ""}`.trim()}
      style={{
        borderColor: `color-mix(in oklab, ${ink} 32%, var(--border-card))`,
        background: `color-mix(in oklab, ${ink} 8%, var(--surface-raised))`,
        color: ink,
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden /> : null}
      <span>{verb}</span>
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}
