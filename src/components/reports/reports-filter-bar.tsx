"use client";

import { useRouter } from "next/navigation";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import type {
  ReportFilterKey,
  ReportFilterState,
  ReportsPageModel,
} from "@/lib/reports/types";

/**
 * Filter toolbar for the Core exports surface, composed from the shared
 * FilterBar / FilterSelect so it matches Work, Renewals, and Evidence. Only the
 * dimensions the active report supports are rendered (`applicableFilters`), so a
 * report never shows a no-op control. Selecting an option navigates immediately
 * (no Apply step); Clear returns to the report's default view.
 *
 * The href is built inline from `resetHref` rather than importing the reports
 * model — that module pulls server-only loaders, so it must not reach the client
 * bundle. `resetHref` already encodes the active report (or omits it when it's the
 * default), so reusing it as the base keeps the report param correct.
 */
export function ReportsFilterBar({
  filters,
  filterOptions,
  applicableFilters,
  resetHref,
  labels,
  ariaLabel,
}: {
  activeReport: string;
  filters: ReportFilterState;
  filterOptions: ReportsPageModel["filterOptions"];
  applicableFilters: ReportFilterKey[];
  resetHref: string;
  labels: { window: string; owner: string; counterparty: string; status: string };
  ariaLabel: string;
}) {
  const router = useRouter();

  // resetHref is "/reports" or "/reports?report=X" (current report, no filters).
  const reportParam = new URLSearchParams(
    resetHref.includes("?") ? resetHref.slice(resetHref.indexOf("?") + 1) : ""
  ).get("report");

  function hrefFor(next: ReportFilterState) {
    const params = new URLSearchParams();
    if (reportParam) params.set("report", reportParam);
    // Mirror buildReportsHref: the 90-day window is the default and stays out of
    // the URL; empty attribute filters are dropped.
    if (next.window !== "90") params.set("window", next.window);
    if (next.owner) params.set("owner", next.owner);
    if (next.counterparty) params.set("counterparty", next.counterparty);
    if (next.status) params.set("status", next.status);
    const qs = params.toString();
    return qs ? `/reports?${qs}` : "/reports";
  }

  const navigate = (key: ReportFilterKey, value: string) =>
    router.push(hrefFor({ ...filters, [key]: value } as ReportFilterState));

  const optionsByKey: Record<ReportFilterKey, ReportsPageModel["filterOptions"]["windows"]> = {
    window: filterOptions.windows,
    owner: filterOptions.owners,
    counterparty: filterOptions.counterparties,
    status: filterOptions.statuses,
  };

  // A windowed report's default 90-day horizon doesn't count as a narrowing filter.
  const activeFilterCount = applicableFilters.filter((key) =>
    key === "window" ? filters.window !== "90" : Boolean(filters[key])
  ).length;

  return (
    <FilterBar
      ariaLabel={ariaLabel}
      activeFilterCount={activeFilterCount}
      clearFiltersHref={resetHref}
    >
      {applicableFilters.map((key) => (
        <FilterSelect
          key={key}
          label={labels[key]}
          value={filters[key]}
          options={optionsByKey[key]}
          onChange={(value) => navigate(key, value)}
          // Wider cap: a long owner/counterparty name is the one thing a filter
          // must never hide.
          className="max-w-[17rem]"
          // The window default (90) isn't the first option, so drive its active
          // tint explicitly; the others fall back to the value-vs-default heuristic.
          active={key === "window" ? filters.window !== "90" : undefined}
        />
      ))}
    </FilterBar>
  );
}
