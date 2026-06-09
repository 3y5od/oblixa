import type { ReactNode } from "react";

/**
 * The one outer wrapper + integrated surface for the Core dense data pages
 * (Contracts, Work, Renewals, Evidence, Reports). Today each page hand-rolls its
 * own page-stack width and stacks toolbar / table / footer as detached blocks;
 * this encodes the canonical recipe once so the five surfaces share gutters,
 * width, card radius, and border strength instead of drifting apart.
 *
 * `DataSurfaceShell` owns the page-stack + canonical max-width:
 *   - `wide`   → max-w-[1440px]  (dense inventories: Contracts, Work)
 *   - `medium` → max-w-7xl       (Renewals, Evidence, Reports)
 *
 * `DataSurfaceCard` is the single integrated surface — a summary band, filter
 * bar, table/list, and footer in ONE `.ui-card` (the Evidence pattern), so a
 * page stops reading as three separate modules. Each region brings its own
 * top/bottom hairline (FilterBar's band chrome, DataFooter's `border-t`), so the
 * card itself is `p-0` and just stacks them.
 *
 * See docs/ui-design-principles.md §5 (page architecture), §7.5 (tables),
 * §10.5 (no card-within-card), §10.6 (single focal surface).
 */

export type DataSurfaceWidth = "wide" | "medium";

const SHELL_MAX_WIDTH: Record<DataSurfaceWidth, string> = {
  // Dense inventories that benefit from horizontal room (matches /work).
  wide: "max-w-[1440px]",
  // The medium cohort — keeps Renewals/Evidence/Reports at one shared width.
  medium: "max-w-7xl",
};

export interface DataSurfaceShellProps {
  /** Canonical content width. Defaults to `medium`. */
  width?: DataSurfaceWidth;
  /** The page identity — typically a `<DashboardPageHeader />`. */
  header?: ReactNode;
  /** Page sections: usually one `<DataSurfaceCard />`, optionally preceded by
   *  a focal/empty-state surface. */
  children: ReactNode;
  className?: string;
}

export function DataSurfaceShell({
  width = "medium",
  header,
  children,
  className,
}: DataSurfaceShellProps) {
  return (
    <div
      className={`ui-page-stack mx-auto w-full min-w-0 ${SHELL_MAX_WIDTH[width]}${
        className ? ` ${className}` : ""
      }`}
    >
      {header}
      {children}
    </div>
  );
}

export interface DataSurfaceCardProps {
  /** Optional summary band (e.g. `<MetricSummaryBand />`) at the top of the card. */
  summary?: ReactNode;
  /** Optional filter region (e.g. `<FilterBar />`) below the summary. */
  filters?: ReactNode;
  /** The table or responsive card list — the surface's primary content. */
  children: ReactNode;
  /** Optional footer (e.g. `<DataFooter />`). */
  footer?: ReactNode;
  className?: string;
}

/**
 * One integrated `.ui-card` holding summary → filters → table → footer. `p-0`
 * because each stacked region owns its own padding and hairline; the card only
 * provides the standard radius, border strength, and overflow clipping so the
 * regions read as one surface rather than a wall of detached boxes.
 */
export function DataSurfaceCard({
  summary,
  filters,
  children,
  footer,
  className,
}: DataSurfaceCardProps) {
  return (
    <section
      className={`ui-card min-w-0 max-w-full overflow-hidden p-0${
        className ? ` ${className}` : ""
      }`}
    >
      {summary}
      {filters}
      <div className="min-w-0 max-w-full">{children}</div>
      {footer}
    </section>
  );
}
