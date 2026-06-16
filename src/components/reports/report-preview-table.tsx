import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DATE_COLUMNS,
  DATE_STATE_COLUMNS,
  DATE_STATE_META,
  dateStateKey,
  isMutedValue,
  NEXT_ACTION_COLUMNS,
  NUMERIC_COLUMNS,
  REPORT_COUNT_NOUN,
  REPORT_DATE_STATE,
  STATUS_COLUMNS,
  STATUS_ICON,
  statusToSemantic,
} from "@/components/reports/report-display";
import { REPORTS_DATE_STATE_DISCLOSURE } from "@/lib/reports/spec-strings";
import type { ReportsPageModel } from "@/lib/reports/types";

/**
 * The active report staged as a ledger artifact — the page's "report becomes
 * exportable operational record" moment. A captioned scope line states exactly
 * what is shown ("Showing 2 of 2 matching renewal rows"), the rows sit inside a
 * quiet paper-toned frame with a header band and fine row rules, and date-bearing
 * reports close with a trust disclosure so an exported CSV is never mistaken for
 * fully confirmed data. The primary column leads and wraps so contract names are
 * never clipped mid-word; mono dates/counts stay tight and tabular.
 */
export function ReportPreviewTable({
  model,
  emptyStateLabel,
  previewLabel,
}: {
  model: ReportsPageModel;
  emptyStateLabel: string;
  previewLabel: string;
}) {
  const gridTemplate = model.previewColumns
    .map((column, index) => `minmax(0, ${columnWeight(column, index)}fr)`)
    .join(" ");
  const hasRows = model.previewRows.length > 0;
  const showsDateState = REPORT_DATE_STATE.has(model.activeReport);
  const noun = REPORT_COUNT_NOUN[model.activeReport];
  const nounWord = model.totalPreviewRows === 1 ? noun.singular : noun.plural;

  return (
    <section aria-label={previewLabel} className="px-5 py-4">
      <div className="mb-3 flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
          {previewLabel}
        </h3>
        {hasRows ? (
          <p className="text-[12px] leading-snug text-[var(--text-tertiary)] tabular-nums">
            Showing {model.previewRows.length} of {model.totalPreviewRows} matching {nounWord}
          </p>
        ) : null}
      </div>

      {!hasRows ? (
        <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,var(--surface-raised))] px-4 py-8 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {emptyStateLabel}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_22%,var(--surface-raised))]">
          {/* Header band — `text-[10px]` holds a long caps label ("RENEWAL DATE")
              inside its narrow column instead of truncating to "RENEWAL D…". */}
          <div
            className="ui-table-header hidden gap-3 px-4 py-2.5 text-[10px] lg:grid"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {model.previewColumns.map((column) => (
              <span key={column} className="min-w-0 truncate">
                {column}
              </span>
            ))}
          </div>
          <div className="bg-[var(--surface-raised)]">
            {model.previewRows.map((row) => (
              <div
                key={row.id}
                className="ui-table-row flex flex-col gap-2 px-4 py-2.5 last:border-b-0 lg:grid lg:items-center lg:gap-3"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {model.previewColumns.map((column, index) => (
                  <div key={`${row.id}-${column}`} className="min-w-0 space-y-1">
                    <p className="ui-caps-3 text-[var(--text-tertiary)] lg:hidden">{column}</p>
                    <ReportCellValue
                      column={column}
                      value={row.cells[column] ?? ""}
                      isPrimary={index === 0}
                      href={index === 0 ? row.href ?? undefined : undefined}
                      rowHref={row.href ?? undefined}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {showsDateState && hasRows ? (
        <p className="mt-2.5 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
          {REPORTS_DATE_STATE_DISCLOSURE}
        </p>
      ) : null}
    </section>
  );
}

function ReportCellValue({
  column,
  value,
  isPrimary,
  href,
  rowHref,
}: {
  column: string;
  value: string;
  isPrimary: boolean;
  href?: string;
  rowHref?: string;
}) {
  const isEmpty = value.trim().length === 0;

  // Primary entity column — links, but reads primary-text with a hover accent
  // rather than always-blue. Wraps to two lines instead of clipping mid-word.
  if (isPrimary) {
    if (href && !isEmpty) {
      return (
        <Link
          href={href}
          title={value}
          className="line-clamp-2 font-semibold leading-snug text-[var(--text-primary)] underline-offset-2 transition-colors [overflow-wrap:anywhere] hover:text-[var(--accent-strong)] hover:underline"
        >
          {value}
        </Link>
      );
    }
    return (
      <p
        title={isEmpty ? undefined : value}
        className="line-clamp-2 font-semibold leading-snug text-[var(--text-primary)] [overflow-wrap:anywhere]"
      >
        {isEmpty ? "—" : value}
      </p>
    );
  }

  // Date provenance → quiet glyph + sentence-case label tinted as reinforcement,
  // so a date's trust state (confirmed/calculated/suggested/missing) is explicit
  // without a loud badge blanketing the column.
  if (DATE_STATE_COLUMNS.has(column)) {
    const meta = DATE_STATE_META[dateStateKey(value)];
    const Icon = meta.icon;
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[12px] font-medium"
        style={{ color: meta.ink }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        {meta.label}
      </span>
    );
  }

  // No value yet → em-dash, never blank.
  if (isEmpty) {
    return <span className="font-mono text-[13px] text-[var(--text-tertiary)]">{"—"}</span>;
  }

  // Status → structured badge with a per-semantic glyph so it reads without
  // relying on color alone.
  if (STATUS_COLUMNS.has(column)) {
    const semantic = statusToSemantic(value);
    const Icon = STATUS_ICON[semantic];
    return (
      <StatusBadge status={semantic} className="gap-1">
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
        {value}
      </StatusBadge>
    );
  }

  // Dates → tabular mono for stable scanning. A literal "Missing" marks a real
  // data gap, so it reads warning rather than neutral.
  if (DATE_COLUMNS.has(column)) {
    const missing = value.trim().toLowerCase() === "missing";
    return (
      <span
        className={`font-mono text-[12.5px] tabular-nums ${
          missing ? "text-[var(--warning-ink)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {value}
      </span>
    );
  }

  if (NUMERIC_COLUMNS.has(column)) {
    const numeric = Number(value);
    const danger = column === "High severity" && Number.isFinite(numeric) && numeric > 0;
    return (
      <span
        className={`font-mono text-[13px] tabular-nums ${
          danger ? "font-semibold text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {value}
      </span>
    );
  }

  // Next action is the recommended step. It reads as a structured affordance with
  // a trailing arrow and links to where the step is performed, staying neutral
  // until hover so the column does not blanket the table in accent.
  if (NEXT_ACTION_COLUMNS.has(column)) {
    const tokenBase =
      "inline-flex max-w-full items-center gap-1.5 rounded-[4px] border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface)] py-0.5 pl-2.5 pr-2 text-[11.5px] font-medium text-[var(--text-secondary)]";
    const inner = (
      <>
        <span className="truncate">{value}</span>
        <ArrowRight
          className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]"
          strokeWidth={2}
          aria-hidden
        />
      </>
    );
    return rowHref ? (
      <Link
        href={rowHref}
        aria-label={value}
        className={`group transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:text-[var(--accent-strong)] ${tokenBase}`}
      >
        {inner}
      </Link>
    ) : (
      <span className={tokenBase}>{inner}</span>
    );
  }

  // Plain entity-text values (counterparty, type, missing-field lists) wrap to two
  // lines rather than truncating a name to "Ridgeway Support L…"; the full value
  // stays available on hover/aria for the rare overflow.
  return (
    <span
      title={value}
      className={`line-clamp-2 leading-snug [overflow-wrap:anywhere] ${
        isMutedValue(value) ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
      }`}
    >
      {value}
    </span>
  );
}

/**
 * Fractional grid weight for a preview column. The primary entity column leads;
 * mono number/date columns stay tight; entity-text columns (counterparty,
 * missing-field lists) get the remaining slack so they stop truncating mid-word.
 */
function columnWeight(column: string, index: number): number {
  if (index === 0) return 1.8;
  if (NUMERIC_COLUMNS.has(column)) return 0.7;
  if (DATE_STATE_COLUMNS.has(column)) return 0.95;
  // Date data is compact ("Aug 11, 2026"), but the caps header ("RENEWAL DATE")
  // is the long pole — give the column enough width that the header scans in full.
  if (DATE_COLUMNS.has(column)) return 1.05;
  if (STATUS_COLUMNS.has(column)) return 1.0;
  // The next-action chip carries a verb phrase plus a trailing arrow — give it
  // room so the recommended step reads in full rather than clipping.
  if (NEXT_ACTION_COLUMNS.has(column)) return 1.35;
  if (column === "Missing details") return 1.6;
  if (column === "Counterparty") return 1.6;
  return 1.0;
}
