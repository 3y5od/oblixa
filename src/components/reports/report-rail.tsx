import Link from "next/link";
import { CountChip } from "@/components/ui/count-chip";
import { REPORT_RAIL_GROUPS } from "@/components/reports/report-display";
import type { ReportNavigationItem } from "@/lib/reports/types";

/**
 * Report selector for the Core exports surface.
 *
 * A grouped vertical rail, not a horizontal tab strip — the strip overflowed
 * and clipped labels ("Evidence rec…") because ten equal-weight tabs never fit
 * the available width. Titled groups give the list hierarchy; the active report
 * is a filled accent row with a left marker. Counts render as one uniform
 * CountChip vocabulary (a nav count is informational, not a status alarm), shown
 * only when non-zero so there is no row of "0" bubbles.
 */
export function ReportRail({
  items,
  ariaLabel = "Reports",
  className,
}: {
  items: ReportNavigationItem[];
  ariaLabel?: string;
  className?: string;
}) {
  const byKey = new Map(items.map((item) => [item.key, item]));

  return (
    <nav aria-label={ariaLabel} className={`flex flex-col gap-4 ${className ?? ""}`.trim()}>
      {REPORT_RAIL_GROUPS.map((group) => {
        const groupItems = group.keys
          .map((key) => byKey.get(key))
          .filter((item): item is ReportNavigationItem => Boolean(item));
        if (groupItems.length === 0) return null;

        return (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="ui-caps-3 px-2.5 pb-1 text-[var(--text-tertiary)]">{group.label}</p>
            {groupItems.map((item) => {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  title={
                    item.count > 0
                      ? `${item.label} — ${item.count} matching ${item.count === 1 ? "record" : "records"}`
                      : item.label
                  }
                  className={`ui-chip-focus relative flex min-h-9 items-center justify-between gap-2 rounded-lg py-2 pl-3.5 pr-2.5 text-[13px] leading-tight transition-colors ${
                    item.active
                      ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] font-semibold text-[var(--accent-strong)]"
                      : "text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {/* Active rail — a full-height accent marker pinned to the left
                      edge so the selected report reads at a glance. */}
                  {item.active ? (
                    <span
                      aria-hidden
                      className="absolute left-0 inset-y-1 w-[3px] rounded-full bg-[var(--accent)]"
                    />
                  ) : null}
                  <span className="min-w-0 truncate">{item.label}</span>
                  {/* One uniform count vocabulary across every report — the
                      active row's chip is emphasized, the rest stay subtle. */}
                  {item.count > 0 ? (
                    <CountChip value={item.count} emphasis={item.active ? "strong" : "subtle"} />
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
