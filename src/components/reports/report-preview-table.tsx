import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import {
  DATE_COLUMNS,
  isMutedValue,
  NEXT_ACTION_COLUMNS,
  NUMERIC_COLUMNS,
  STATUS_COLUMNS,
  statusToSemantic,
} from "@/components/reports/report-display";
import type { ReportsPageModel } from "@/lib/reports/types";

/** Per-semantic glyph so status reads without relying on color alone (§7.7 / issue 15). */
const STATUS_ICON: Record<SemanticStatus, LucideIcon> = {
  healthy: CheckCircle2,
  info: Info,
  in_review: Clock,
  warning: AlertTriangle,
  blocked: Ban,
  overdue: AlertCircle,
  critical: XCircle,
  empty: MinusCircle,
  disabled: MinusCircle,
};

/**
 * Flat, dense preview of the active report.
 *
 * The meta row pairs a LIVE preview marker — now the shared `StatusBadge`, not a
 * bare color-only dot (issue 12) — with an explicit export-freshness state: a
 * real "Not exported yet" badge rather than an ambiguous dash (issues 13 / 20).
 * The primary column gets the lion's share of the grid and wraps to two lines so
 * contract names stop being clipped mid-word (issue 14).
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
  const columnCount = model.previewColumns.length;
  const gridTemplate =
    columnCount > 1
      ? `minmax(0, 1.7fr) repeat(${columnCount - 1}, minmax(0, 1fr))`
      : "minmax(0, 1fr)";
  const hasRows = model.previewRows.length > 0;

  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="ui-caps-2 text-[var(--text-tertiary)]">{previewLabel}</span>
          <StatusBadge status="healthy">Live</StatusBadge>
        </div>
        <div className="flex items-center gap-1.5">
          {model.lastGeneratedAt ? (
            <>
              <span className="ui-caps-2 text-[var(--text-tertiary)]">Last export</span>
              <span className="font-mono text-[11.5px] tabular-nums text-[var(--text-secondary)]">
                {model.lastGeneratedLabel}
              </span>
            </>
          ) : (
            <StatusBadge status="empty">Not exported yet</StatusBadge>
          )}
        </div>
      </div>

      {!hasRows ? (
        <div className="flex items-center gap-3 border-y border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] py-8 text-[13px] text-[var(--text-secondary)]">
          {emptyStateLabel}
        </div>
      ) : (
        <div>
          <div
            className="hidden gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] pb-2 lg:grid"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {model.previewColumns.map((column) => (
              <span key={column} className="ui-caps-3 text-[var(--text-tertiary)]">
                {column}
              </span>
            ))}
          </div>
          <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)]">
            {model.previewRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-md py-2.5 transition-colors lg:grid lg:items-center lg:gap-3 lg:hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)]"
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
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {model.totalPreviewRows > model.previewRows.length ? (
        <p className="mt-3 ui-caps-3 text-[var(--text-tertiary)] tabular-nums">
          Preview {model.previewRows.length} of {model.totalPreviewRows} rows
        </p>
      ) : null}
    </div>
  );
}

function ReportCellValue({
  column,
  value,
  isPrimary,
  href,
}: {
  column: string;
  value: string;
  isPrimary: boolean;
  href?: string;
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
          className="line-clamp-2 font-semibold text-[var(--text-primary)] underline-offset-2 transition-colors [overflow-wrap:anywhere] hover:text-[var(--accent-strong)] hover:underline"
        >
          {value}
        </Link>
      );
    }
    return (
      <p className="line-clamp-2 font-semibold text-[var(--text-primary)] [overflow-wrap:anywhere]">
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

  // Next action is a recommended step, not a link — a quiet bordered token with
  // a leading chevron reads as "do this next" without the inert flatness of bare
  // caps (issue 16) or masquerading as an action target (issue 20).
  if (NEXT_ACTION_COLUMNS.has(column)) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface)] py-0.5 pl-1.5 pr-2 text-[11.5px] font-medium text-[var(--text-secondary)]">
        <ChevronRight className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" strokeWidth={2} aria-hidden />
        <span className="truncate">{value}</span>
      </span>
    );
  }

  return (
    <span
      className={`block truncate ${
        isMutedValue(value) ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
      }`}
    >
      {value}
    </span>
  );
}
