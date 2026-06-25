import { CornerDownRight, Link2 } from "lucide-react";
import { DateProvenanceBadge } from "@/components/ui/date-provenance-badge";
import {
  RENEWAL_DATE_REVIEW_HINTS,
  RENEWAL_DATE_REVIEW_LABELS,
} from "@/lib/renewals/spec-strings";
import type { RenewalDateReviewState } from "@/lib/renewals/types";
import { REVIEW_TO_PROVENANCE } from "./renewals-ledger-constants";

export function RenewalDateCell({
  label,
  dateLabel,
  days,
  review,
  basis,
  prominent = false,
  chained = false,
}: {
  label: string;
  dateLabel: string;
  days: number | null;
  review: RenewalDateReviewState;
  basis: string | null;
  prominent?: boolean;
  chained?: boolean;
}) {
  const empty = review === "missing";
  const overdue = days != null && days < 0;
  const urgent = prominent && !empty && days != null && days <= 14;

  if (prominent) {
    const railInk = empty
      ? "var(--warning-ink)"
      : overdue
        ? "var(--danger-ink)"
        : urgent
          ? "var(--warning-ink)"
          : "var(--calculated-ink)";
    // Ledger-stamp wash: a faint left-bleed that fades to the sheet, NOT a filled
    // boxed field. The rail (a thicker left rule) carries the material weight; the
    // tint only stains the stamp's left margin so the cell reads as a struck
    // ledger entry, not a form card. Calm/derived states stay on a cool-steel
    // wash; risk states warm to amber/oxblood.
    const wash = empty
      ? "color-mix(in oklab, var(--warning-soft) 16%, transparent)"
      : overdue
        ? "color-mix(in oklab, var(--danger-soft) 42%, transparent)"
        : urgent
          ? "color-mix(in oklab, var(--warning-soft) 40%, transparent)"
          : "color-mix(in oklab, var(--surface-cool) 80%, transparent)";
    const dateInk = empty
      ? "var(--text-tertiary)"
      : overdue || urgent
        ? railInk
        : "var(--text-primary)";
    return (
      <div className="min-w-0">
        <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">{label}</p>
        {/* Date-ledger entry, not a boxed plaque: a single weighted left rule
            stamps the column; the date, countdown, provenance, and the
            notice-window basis stack as one tight unit bound by that rule, with a
            faint margin wash for material weight instead of a full border. */}
        <div
          className="min-w-0 border-l-[3px] py-0.5 pl-2.5"
          style={{
            borderColor: railInk,
            backgroundImage: `linear-gradient(to right, ${wash}, transparent 72%)`,
          }}
        >
          <p
            className={`flex items-baseline gap-1 leading-[1.12] tabular-nums ${
              empty ? "text-[13px]" : "text-[17px] font-semibold tracking-[-0.01em]"
            }`}
            style={{ color: dateInk }}
          >
            {chained && !empty ? (
              <Link2
                className="h-3.5 w-3.5 shrink-0 self-center"
                style={{ color: `color-mix(in oklab, ${railInk} 70%, var(--text-tertiary))` }}
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
            <span className={empty ? "italic" : ""}>{dateLabel}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-y-1">
            {days != null ? (
              <>
                <RenewalDueChip days={days} prominent={urgent || overdue} />
                <span className="ui-rule-vert" aria-hidden />
              </>
            ) : null}
            <DateProvenanceBadge
              state={REVIEW_TO_PROVENANCE[review]}
              label={RENEWAL_DATE_REVIEW_LABELS[review]}
              hint={RENEWAL_DATE_REVIEW_HINTS[review]}
              srPrefix={label}
            />
          </div>
          {basis ? (
            <p className="mt-1 flex items-start gap-1 border-t border-[color:color-mix(in_oklab,var(--calculated-ink)_24%,var(--border-subtle))] pt-1 text-[10px] leading-snug text-[var(--text-tertiary)]">
              <CornerDownRight className="mt-px h-3 w-3 shrink-0 text-[var(--calculated-ink)]" strokeWidth={2} aria-hidden />
              <span className="max-w-[15rem]">{basis}</span>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="ui-caps-3 mb-1.5 block text-[10.5px] text-[var(--text-tertiary)] xl:sr-only">{label}</p>
      <p
        className={`leading-snug tabular-nums text-[13px] ${
          empty ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
        }`}
      >
        <span className={empty ? "italic" : ""}>{dateLabel}</span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-y-1">
        {days != null ? (
          <>
            <RenewalDueChip days={days} prominent={false} />
            <span className="ui-rule-vert" aria-hidden />
          </>
        ) : null}
        <DateProvenanceBadge
          state={REVIEW_TO_PROVENANCE[review]}
          label={RENEWAL_DATE_REVIEW_LABELS[review]}
          hint={RENEWAL_DATE_REVIEW_HINTS[review]}
          srPrefix={label}
        />
      </div>
    </div>
  );
}

function RenewalDueChip({ days, prominent = false }: { days: number | null; prominent?: boolean }) {
  if (days == null) return null;
  const overdue = days < 0;
  const near = days >= 0 && days <= 14;
  const ink = overdue ? "var(--danger-ink)" : near ? "var(--warning-ink)" : "var(--text-tertiary)";
  const label = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`;
  const description = overdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `In ${days} days`;
  if (prominent && (overdue || near)) {
    return (
      <span
        aria-label={description}
        title={description}
        className="ui-caps-3 inline-flex items-center whitespace-nowrap rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums"
        style={{
          color: ink,
          background: `color-mix(in oklab, ${overdue ? "var(--danger-soft)" : "var(--warning-soft)"} 60%, var(--surface-raised))`,
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${ink} 30%, transparent)`,
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      aria-label={description}
      title={description}
      className="ui-caps-3 inline-flex items-center whitespace-nowrap text-[10.5px] leading-none tabular-nums"
      style={{ color: ink }}
    >
      {label}
    </span>
  );
}
