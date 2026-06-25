import Link from "next/link";
import { DashboardActionRow } from "@/components/dashboard/dashboard-action-row";
import { DateProvenanceBadge } from "@/components/ui/date-provenance-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { formatMonthDay } from "@/lib/ui-copy";
import type { CoreDashboardDeadlineRow } from "@/lib/dashboard/core-dashboard-model";
import { EMAIL_RE, MetaDataFlag } from "./core-dashboard-data-flags";

export function DeadlineRows({ rows, compact = false }: { rows: CoreDashboardDeadlineRow[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) =>
        compact ? <DeadlineRowCompact key={row.id} row={row} /> : <DeadlineRow key={row.id} row={row} />
      )}
    </ul>
  );
}

/** Compact date row for the right context rail: contract + date type/provenance on
 *  the left, and an aligned date cell (date over relative time, plain text — not a
 *  chip) on the right. Only the nearest dates carry a subtle severity marker; the
 *  rest stay plain so urgency reads (§ dates are data, not badges). */
function DeadlineRowCompact({ row }: { row: CoreDashboardDeadlineRow }) {
  const urgent = row.daysRemaining <= 7;
  const titleText = row.contractTitle?.trim() || row.label;
  const calc = row.source === "derived";
  const monthDay = formatMonthDay(row.date);
  const relative =
    row.daysRemaining === 0
      ? "Today"
      : row.daysRemaining === 1
        ? "In 1 day"
        : `In ${row.daysRemaining} days`;
  return (
    <li>
      <Link
        href={row.href}
        aria-label={`${row.label}: ${titleText}, ${monthDay} ${relative}${calc ? ", calculated" : ", confirmed"}`}
        className="group relative flex items-center gap-3 rounded-[6px] px-2 py-2 transition-colors duration-150 hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
        style={urgent ? { boxShadow: "inset 2px 0 0 0 var(--warning-ink)" } : undefined}
      >
        <div className="min-w-0 flex-1">
          <p title={titleText} className="truncate text-[12.5px] font-semibold leading-tight text-[var(--text-primary)]">
            {titleText}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight text-[var(--text-tertiary)]">
            <span>{row.label}</span>
            <span aria-hidden className="h-2.5 w-px bg-[color:color-mix(in_oklab,var(--border-strong)_50%,transparent)]" />
            <span style={{ color: calc ? "var(--calculated-ink)" : "color-mix(in oklab, var(--success-ink) 82%, var(--text-tertiary))" }}>
              {calc ? "Calculated" : "Confirmed"}
            </span>
          </p>
        </div>
        {/* Aligned date cell — date over relative time, plain text. */}
        <div className="flex shrink-0 flex-col items-end leading-tight">
          <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: urgent ? "var(--warning-ink)" : "var(--text-secondary)" }}>
            {monthDay}
          </span>
          <span className="mt-0.5 text-[11px] tabular-nums" style={{ color: urgent ? "var(--warning-ink)" : "var(--text-tertiary)" }}>
            {relative}
          </span>
        </div>
      </Link>
    </li>
  );
}

function DeadlineRow({ row }: { row: CoreDashboardDeadlineRow }) {
  const urgent = row.daysRemaining <= 7;
  const titleText = row.contractTitle?.trim() || row.label;
  const showEyebrow = Boolean(row.contractTitle?.trim());
  const countdown =
    row.daysRemaining === 0
      ? "Today"
      : `In ${row.daysRemaining} ${row.daysRemaining === 1 ? "day" : "days"}`;

  return (
    <li>
      <DashboardActionRow
        href={row.href}
        ariaLabel={`${row.label}: ${titleText}`}
        rail={urgent ? "warning" : undefined}
        hoverAction="Open contract"
        eyebrow={
          showEyebrow ? (
            // Date type + provenance read as one ledger eyebrow, using the shared
            // Confirmed/Calculated trust vocabulary the /renewals ledger uses so a
            // calculated deadline never reads as a confirmed one (§16 trust).
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">{row.label}</span>
              <span aria-hidden className="h-2.5 w-px bg-[color:color-mix(in_oklab,var(--border-strong)_60%,transparent)]" />
              <DateProvenanceBadge
                state={row.source === "derived" ? "calculated" : "confirmed"}
                srPrefix={row.label}
              />
            </span>
          ) : undefined
        }
        title={
          <p title={titleText} className="mt-0.5 truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
            {titleText}
          </p>
        }
        meta={<DeadlineMeta row={row} />}
        trailing={
          <div className="flex flex-col items-end gap-1 text-right">
            <TimeChip date={row.date} format="calendar" tone={urgent ? "warning" : undefined} bordered className="min-w-[3.75rem] justify-center" />
            <span className="text-[10.5px] font-medium tabular-nums" style={{ color: urgent ? "var(--warning-ink)" : "var(--text-tertiary)" }}>
              {countdown}
            </span>
          </div>
        }
      />
    </li>
  );
}

function DeadlineMeta({ row }: { row: CoreDashboardDeadlineRow }) {
  return (
    <>
      {row.ownerLabel ? (
        EMAIL_RE.test(row.ownerLabel.trim()) ? (
          <p className="mt-0.5">
            <MetaDataFlag kind="owner" raw={row.ownerLabel} />
          </p>
        ) : (
          <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
            <span className="text-[var(--text-tertiary)]">Owner:</span> {row.ownerLabel}
          </p>
        )
      ) : null}
      {row.basis ? (
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">{row.basis}</p>
      ) : null}
    </>
  );
}
