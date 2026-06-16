import Link from "next/link";
import type { StatTone } from "@/components/ui/stat-cell";
import { statToneDot, statToneNumberColor } from "@/components/ui/stat-cell";

/**
 * §64 / §19 / §50 — a count that always states its object type and condition, so
 * a reader never has to infer whether a number refers to contracts, dates,
 * tasks, or evidence. The accessible name is always the full phrase
 * ("2 renewal and notice dates in view") even when the visible chip abbreviates
 * the noun, and when `href` is set the chip links to the matching filtered view
 * (§19: a clickable count must resolve to a view that matches its wording).
 *
 * Shared so every dense Core ledger forms counts the same way.
 */

export interface OperationalCountProps {
  value: number;
  /** Singular object noun, e.g. "renewal and notice date". */
  noun: string;
  /** Plural form; defaults to `noun + "s"`. */
  nounPlural?: string;
  /** Trailing condition, e.g. "in view", "open", "needing confirmation". */
  condition?: string;
  /** Shorter noun for the visible chip when the full noun is long; the full
   *  noun is always used in the accessible label. */
  shortNoun?: string;
  shortNounPlural?: string;
  tone?: StatTone;
  /** Links the count to a view whose contents match this wording. */
  href?: string;
  className?: string;
}

function plural(value: number, singular: string, pluralForm?: string) {
  if (value === 1) return singular;
  return pluralForm ?? `${singular}s`;
}

export function OperationalCount({
  value,
  noun,
  nounPlural,
  condition,
  shortNoun,
  shortNounPlural,
  tone = "neutral",
  href,
  className,
}: OperationalCountProps) {
  const fullNoun = plural(value, noun, nounPlural);
  const visibleNoun = shortNoun ? plural(value, shortNoun, shortNounPlural) : fullNoun;
  const conditionSuffix = condition ? ` ${condition}` : "";
  // The accessible name always carries the full object noun + condition.
  const accessible = `${value} ${fullNoun}${conditionSuffix}`;
  const body = (
    <>
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: statToneDot(tone) }}
      />
      <span
        className="font-semibold tabular-nums"
        style={{ color: statToneNumberColor(tone, value <= 0) }}
      >
        {value}
      </span>
      <span className="font-medium text-[var(--text-secondary)]">
        {visibleNoun}
        {conditionSuffix}
      </span>
    </>
  );
  const shell =
    "inline-flex items-center gap-1.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-2 py-1 text-[11.5px] leading-none";
  if (href) {
    return (
      <Link
        href={href}
        aria-label={accessible}
        className={`ui-chip-focus transition-colors hover:border-[var(--accent)] ${shell} ${className ?? ""}`.trim()}
      >
        {body}
      </Link>
    );
  }
  return (
    <span aria-label={accessible} className={`${shell} ${className ?? ""}`.trim()}>
      {body}
    </span>
  );
}
