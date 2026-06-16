import Link from "next/link";
import {
  REPORT_CATALOG_BLURB,
  REPORT_RAIL_GROUPS,
  reportCountLabel,
} from "@/components/reports/report-display";
import type { ReportNavigationItem } from "@/lib/reports/types";

/**
 * Report catalog for the Core exports surface, composed as a legal index rather
 * than a sidebar menu: titled sections separated by hairline rules, each report
 * an index entry with a short definition and a right-aligned ledger count (a
 * plain tabular number, like a page reference, not a status bubble). The
 * selected report is marked by a left accent rule and a paper tint that reads as
 * a chosen record, distinct from the faint hover wash. Counts carry an
 * object-typed accessible label ("2 renewal rows", "4 contracts") so the number
 * never has to be inferred.
 */
export function ReportRail({
  items,
  ariaLabel = "Report catalog",
  className,
}: {
  items: ReportNavigationItem[];
  ariaLabel?: string;
  className?: string;
}) {
  const byKey = new Map(items.map((item) => [item.key, item]));

  return (
    <nav aria-label={ariaLabel} className={`flex flex-col gap-5 ${className ?? ""}`.trim()}>
      {REPORT_RAIL_GROUPS.map((group) => {
        const groupItems = group.keys
          .map((key) => byKey.get(key))
          .filter((item): item is ReportNavigationItem => Boolean(item));
        if (groupItems.length === 0) return null;

        return (
          <div key={group.label} className="flex flex-col">
            <p className="ui-caps-3 flex items-center gap-2 px-2 pb-2 text-[10px] text-[var(--text-tertiary)]">
              <span>{group.label}</span>
              <span
                aria-hidden
                className="h-px flex-1 bg-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]"
              />
            </p>
            <ul className="flex flex-col">
              {groupItems.map((item) => {
                const countLabel = reportCountLabel(item.key, item.count);
                const blurb = REPORT_CATALOG_BLURB[item.key];
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={item.active ? "page" : undefined}
                      className={`ui-chip-focus group relative flex items-start gap-3 rounded-md py-2 pl-3 pr-2.5 transition-colors ${
                        item.active
                          ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))]"
                          : "hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,transparent)]"
                      }`}
                    >
                      {/* Left accent rule marks the chosen record — a full-height
                          bar pinned to the edge, present only on the active row. */}
                      <span
                        aria-hidden
                        className={`absolute inset-y-1.5 left-0 w-[2.5px] rounded-full ${
                          item.active ? "bg-[var(--accent)]" : "bg-transparent"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[13px] leading-tight ${
                            item.active
                              ? "font-semibold text-[var(--accent-strong)]"
                              : "font-medium text-[var(--text-primary)]"
                          }`}
                        >
                          {item.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-tight text-[var(--text-tertiary)]">
                          {blurb}
                        </span>
                      </span>
                      {/* Ledger count: a right-aligned tabular number in a fixed
                          column so the figures line up like page references.
                          Zero recedes (a report exists but is currently empty);
                          the accessible label names the object type. */}
                      <span
                        aria-hidden
                        className={`mt-px w-9 shrink-0 text-right text-[12.5px] tabular-nums ${
                          item.count === 0
                            ? "text-[var(--text-tertiary)]"
                            : item.active
                              ? "font-semibold text-[var(--accent-strong)]"
                              : "font-medium text-[var(--text-secondary)]"
                        }`}
                      >
                        {item.count}
                      </span>
                      <span className="sr-only">{countLabel}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
