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
  /** Optional fuller definition, shown as a hover/focus tooltip (matching the
   *  Contracts/Tasks condition chips) and appended to the accessible name. */
  description?: string;
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
  description,
  className,
}: OperationalCountProps) {
  const fullNoun = plural(value, noun, nounPlural);
  const visibleNoun = shortNoun ? plural(value, shortNoun, shortNounPlural) : fullNoun;
  const conditionSuffix = condition ? ` ${condition}` : "";
  // The accessible name always carries the full object noun + condition.
  const accessible = `${value} ${fullNoun}${conditionSuffix}`;
  // Optional fuller definition: appended to the accessible name and shown as the
  // same styled hover/focus tooltip the Contracts/Tasks condition chips use.
  const accessibleName = description ? `${accessible}. ${description}` : accessible;
  const tip = description ? (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-[calc(100%+7px)] left-0 z-30 w-max max-w-[16rem] rounded-md bg-[var(--text-primary)] px-2.5 py-1.5 text-[11px] font-normal leading-snug text-[var(--surface)] opacity-0 shadow-[var(--shadow-2)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
    >
      {description}
      <span className="absolute left-3 top-full h-2 w-2 -translate-y-1/2 rotate-45 bg-[var(--text-primary)]" />
    </span>
  ) : null;
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
  const shell = `inline-flex items-center gap-1.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-2 py-1 text-[11.5px] leading-none${description ? " group relative" : ""}`;
  if (href) {
    return (
      <Link
        href={href}
        aria-label={accessibleName}
        className={`ui-chip-focus transition-colors hover:border-[var(--accent)] ${shell} ${className ?? ""}`.trim()}
      >
        {body}
        {tip}
      </Link>
    );
  }
  return (
    <span aria-label={accessibleName} className={`${shell} ${className ?? ""}`.trim()}>
      {body}
      {tip}
    </span>
  );
}
