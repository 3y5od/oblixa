"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { UiSelect } from "@/components/ui/ui-select";
import type {
  ReportFilterKey,
  ReportFilterState,
  ReportsPageModel,
} from "@/lib/reports/types";

type FilterLabels = { window: string; owner: string; counterparty: string; status: string };
type DraftKey = "window" | "owner" | "counterparty" | "status";

// Each pill sizes to its own value rather than a fixed width: the old fixed
// widths clipped the selected value ("90 d…", "Any cou…"), and the selected
// value is the one thing a filter must never hide. Pills grow to fit their
// label + value and wrap, capped so a single long counterparty/owner name can't
// run away (those still carry a hover title and an applied-filter chip below).
const SELECT_MAX_WIDTH = "max-w-[17rem]";

// A filter is "active" (visually distinct) when its draft value differs from the
// report's default for that dimension.
const FILTER_DEFAULTS: Record<DraftKey, string> = {
  window: "90",
  owner: "",
  counterparty: "",
  status: "",
};

/**
 * Filter toolbar for the Core exports surface.
 *
 * The pills are custom comboboxes (`UiSelect`), and only the dimensions the
 * active report supports are rendered (`applicableFilters`) so a report never
 * shows a no-op control. Apply lights up to the primary accent only when a value
 * differs from what's applied — so "do my changes need Apply?" is never
 * ambiguous. Reset clears every applied filter back to the report's default
 * view. Submitting is a plain GET so the selected report + filters persist in
 * the URL.
 */
export function ReportsFilterBar({
  activeReport,
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
  labels: FilterLabels;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState<Record<DraftKey, string>>({
    window: filters.window,
    owner: filters.owner,
    counterparty: filters.counterparty,
    status: filters.status,
  });

  const changed =
    draft.window !== filters.window ||
    draft.owner !== filters.owner ||
    draft.counterparty !== filters.counterparty ||
    draft.status !== filters.status;

  // Reset is offered only when an applicable filter is actually narrowing the
  // report — a default 90-day window on a windowed report doesn't count.
  const hasActiveFilters =
    Boolean(filters.owner || filters.counterparty || filters.status) ||
    (applicableFilters.includes("window") && filters.window !== "90");

  const set = (key: DraftKey) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const optionsFor: Record<DraftKey, ReportsPageModel["filterOptions"]["windows"]> = {
    window: filterOptions.windows,
    owner: filterOptions.owners,
    counterparty: filterOptions.counterparties,
    status: filterOptions.statuses,
  };

  return (
    <form
      action="/reports"
      className="flex flex-wrap items-center gap-x-2.5 gap-y-2"
      aria-label={ariaLabel}
    >
      <input type="hidden" name="report" value={activeReport} />
      {/* Render only the dimensions this report supports, in the model's order,
          so the four-pill row stays visually grouped without no-op controls. */}
      {applicableFilters.map((key) => {
        const isActive = draft[key] !== FILTER_DEFAULTS[key];
        return (
          <UiSelect
            key={key}
            variant="pill"
            portal
            // Menu grows to fit its longest option (a long owner/counterparty
            // name) even when the trigger itself is narrow, so options never
            // truncate inside the dropdown.
            menuWidth="fit"
            label={labels[key]}
            name={key}
            value={draft[key]}
            onChange={set(key)}
            options={optionsFor[key]}
            className={SELECT_MAX_WIDTH}
            // Active filters get an accent ring so a narrowed dimension reads as
            // distinct from a default one ("Any owner"). A ring composes over the
            // trigger's own border without fighting it.
            buttonClassName={`w-full ${
              isActive
                ? "ring-2 ring-[color:color-mix(in_oklab,var(--accent)_38%,transparent)]"
                : ""
            }`}
            ariaLabel={labels[key]}
          />
        );
      })}
      <button
        type="submit"
        disabled={!changed}
        title={changed ? "Apply filter changes" : "No filter changes to apply"}
        className={
          changed
            ? "ui-btn-primary px-4 py-1.5 text-[12.5px]"
            : "ui-btn-secondary px-4 py-1.5 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        Apply
      </button>
      {hasActiveFilters ? (
        <Link
          href={resetHref}
          className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]"
          title="Clear all applied filters"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Reset
        </Link>
      ) : null}
    </form>
  );
}
