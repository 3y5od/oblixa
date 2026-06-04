import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { RatioChip } from "@/components/ui/ratio-chip";
import {
  DATE_COLUMNS,
  isMutedValue,
  NEXT_ACTION_COLUMNS,
  NUMERIC_COLUMNS,
  STATUS_COLUMNS,
  STATUS_ICON,
  statusToSemantic,
} from "@/components/reports/report-display";
import type { ReportsPageModel } from "@/lib/reports/types";

/**
 * Flat, dense preview of the active report.
 *
 * The meta row pairs a LIVE preview marker (the shared `StatusBadge`, not a bare
 * color-only dot) with a row-count summary. Export freshness now lives in the
 * report header beside the title, so the preview header stays focused on the
 * data itself. The primary column gets the lion's share of the grid and wraps to
 * two lines so contract names stop being clipped mid-word.
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
  // Weight columns by semantic type rather than giving every non-primary column
  // an equal 1fr: mono date/number columns are compact and were stealing width
  // from the text columns (counterparty), which then truncated. Entity-text
  // columns get the slack; numbers stay tight.
  const gridTemplate = model.previewColumns
    .map((column, index) => `minmax(0, ${columnWeight(column, index)}fr)`)
    .join(" ");
  const hasRows = model.previewRows.length > 0;
  // When a source query failed, the preview itself may be incomplete — say so
  // here (not just in the page banner) so the data carries its own caveat.
  const isPartial = model.warnings.length > 0;

  return (
    <div className="px-5 py-4">
      {/* One bordered table surface (§7.5): the status band is the table's own
          caption/toolbar — attached above the column header rather than floating
          over it — so the filters, status, and rows read as a single report
          surface instead of a stack of detached strips. */}
      <div className="ui-table-shell">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="ui-caps-2 text-[var(--text-tertiary)]">{previewLabel}</span>
            {/* "Partial data" — not a bare "Partial" — names the data-quality
                signal so it doesn't blur into the "X / Y rows" preview-sample
                count beside it. Warning tone only when a source query failed;
                a complete read reads "Live". */}
            {isPartial ? (
              <StatusBadge status="warning">Partial data</StatusBadge>
            ) : (
              <StatusBadge status="healthy">Live</StatusBadge>
            )}
          </div>
          {hasRows ? (
            model.totalPreviewRows > model.previewRows.length ? (
              <span
                title={`Showing ${model.previewRows.length} of ${model.totalPreviewRows} matching rows — export for the full set`}
                aria-label={`Showing ${model.previewRows.length} of ${model.totalPreviewRows} matching rows`}
              >
                <RatioChip
                  numerator={model.previewRows.length}
                  denominator={model.totalPreviewRows}
                  suffix="rows"
                />
              </span>
            ) : (
              <span title={`${model.totalPreviewRows} matching rows`}>
                <KeyValueChip label="Rows" value={model.totalPreviewRows} />
              </span>
            )
          ) : null}
        </div>

        {!hasRows ? (
          <div className="flex items-center gap-3 px-4 py-8 text-[13px] text-[var(--text-secondary)]">
            {emptyStateLabel}
          </div>
        ) : (
          <div>
            <div
              // `text-[10px]` holds the header a notch under `.ui-table-header`'s
              // 11px so a long caps label ("RENEWAL DATE") still fits its narrow
              // date column instead of truncating to "RENEWAL D…".
              className="ui-table-header hidden gap-3 px-4 py-2 text-[10px] lg:grid"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {model.previewColumns.map((column) => (
                // `min-w-0 truncate` lets these grid items shrink below their
                // content — without it a long unbreakable caps header like
                // "COUNTERPARTY" pins the column's min-width and the shell
                // overflows horizontally. Caps styling comes from
                // `.ui-table-header` on the row.
                <span key={column} className="min-w-0 truncate">
                  {column}
                </span>
              ))}
            </div>
            <div>
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
      </div>
    </div>
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
  // rather than always-blue (issue 17, round 1). Wraps to two lines instead of
  // truncating so names aren't clipped mid-word (issue 14).
  if (isPrimary) {
    if (href && !isEmpty) {
      return (
        <Link
          href={href}
          title={value}
          className="line-clamp-2 font-semibold text-[var(--text-primary)] underline-offset-2 transition-colors [overflow-wrap:anywhere] hover:text-[var(--accent-strong)] hover:underline"
        >
          {value}
        </Link>
      );
    }
    return (
      <p
        title={isEmpty ? undefined : value}
        className="line-clamp-2 font-semibold text-[var(--text-primary)] [overflow-wrap:anywhere]"
      >
        {isEmpty ? "—" : value}
      </p>
    );
  }

  // No value yet → em-dash, never blank (§10.12 / issue 13).
  if (isEmpty) {
    return <span className="font-mono text-[13px] text-[var(--text-tertiary)]">{"—"}</span>;
  }

  // Status → structured badge with a per-semantic glyph so it reads without
  // relying on color alone (issue 15).
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

  // Dates → tabular mono for stable scanning (issue 18). A literal "Missing"
  // marks a real data gap, so it reads warning rather than neutral.
  if (DATE_COLUMNS.has(column)) {
    const missing = value.trim().toLowerCase() === "missing";
    return (
      <span
        className={`font-mono text-[12px] tabular-nums ${
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
        className={`font-mono text-[12.5px] tabular-nums ${
          danger ? "font-semibold text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {value}
      </span>
    );
  }

  // Next action is the recommended step. It now reads as a structured affordance
  // with a trailing arrow that telegraphs intent (§8.6) and links to the contract
  // where the step is performed, staying neutral until hover so the column does
  // not blanket the table in accent (§10.2). Falls back to a static token when
  // there is no destination.
  if (NEXT_ACTION_COLUMNS.has(column)) {
    // ActionChip pill shape (rounded-full + trailing arrow) for a consistent
    // action vocabulary, but held neutral until hover: a full column of always-on
    // accent pills would blanket the table in color (§10.2). Hover promotes the
    // chip to accent and nudges the arrow (§8.6).
    const tokenBase =
      "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface)] py-0.5 pl-2.5 pr-2 text-[11.5px] font-medium text-[var(--text-secondary)]";
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

  // Plain values (counterparty, type, missing-field lists) truncate, so expose
  // the full value on hover/aria for the cases that overflow (issue: counterparty
  // truncation needs full title).
  return (
    <span
      title={value}
      className={`block truncate ${
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
  // Date data is compact ("Aug 11, 2026"), but the caps header ("RENEWAL DATE",
  // "NEXT DUE DATE") is the long pole — give the column enough width that the
  // header label scans in full rather than truncating.
  if (DATE_COLUMNS.has(column)) return 1.05;
  if (STATUS_COLUMNS.has(column)) return 1.0;
  // The next-action chip carries a verb phrase ("Open renewal", "Add notice
  // date") plus a trailing arrow — give it room so the recommended step reads in
  // full rather than clipping to "Open rene…".
  if (NEXT_ACTION_COLUMNS.has(column)) return 1.35;
  if (column === "Missing fields") return 1.6;
  if (column === "Counterparty") return 1.3;
  return 1.0;
}
