import Link from "next/link";
import { CountChip } from "@/components/ui/count-chip";
import { REPORT_RAIL_GROUPS, reportToneFor } from "@/components/reports/report-display";
import type { ReportNavigationItem } from "@/lib/reports/types";

/**
 * Report selector for the Core exports surface.
 *
 * A grouped vertical rail, not a horizontal tab strip — the strip overflowed
 * and clipped labels ("Evidence rec…") because ten equal-weight tabs never fit
 * the available width (issues 1 / 7 / 9). Titled groups give the list hierarchy;
 * the active report is a filled accent row with a left marker. Counts are shown
 * only when non-zero (issue 8 — no row of "0" bubbles) and tone-coded solely for
 * the genuine risk reports (issue 19), so amber/red still read as a signal.
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
              const tone = item.count > 0 ? reportToneFor(item.key) : undefined;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`ui-chip-focus relative flex items-center justify-between gap-2 rounded-lg py-1.5 pl-3 pr-2.5 text-[13px] leading-tight transition-colors ${
                    item.active
                      ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_46%,var(--surface-raised))] font-semibold text-[var(--accent-strong)]"
                      : "text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item.active ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent)]"
                    />
                  ) : null}
                  <span className="min-w-0 truncate">{item.label}</span>
                  {item.count > 0 ? (
                    <CountChip
                      value={item.count}
                      tone={tone}
                      emphasis={item.active ? "strong" : "subtle"}
                    />
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
