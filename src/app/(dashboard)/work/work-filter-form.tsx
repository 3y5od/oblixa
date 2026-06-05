"use client";

import { useRouter } from "next/navigation";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { buildWorkHref } from "@/lib/work/model";
import { WORK_FILTER_LABELS } from "@/lib/work/spec-strings";
import type { WorkFilterState, WorkOption, WorkPageModel, WorkSortKey } from "@/lib/work/types";
import { WorkSortSelect } from "./work-sort-select";

type WorkFilterFormProps = {
  /** The currently-applied filters (from the URL). */
  filters: WorkFilterState;
  filterOptions: WorkPageModel["filterOptions"];
  activeTab: WorkPageModel["activeTab"];
  sort: WorkSortKey;
  sortOptions: WorkOption[];
  keepCreateOpen: boolean;
  /** Active (non-default) filter dimensions — drives the "Filters N" chip + Clear. */
  activeFilterCount: number;
  /** Pre-built href that clears every filter while preserving tab, sort, and
   *  create state. Computed by the page via `buildWorkHref`. */
  clearFiltersHref: string;
};

/**
 * The /work filter bar, composed from the shared FilterBar / FilterSelect so it
 * matches Renewals, Evidence, and Reports. Selecting any option navigates
 * immediately via `buildWorkHref` (no Apply step), so the controlled selects
 * always mirror the URL. Sort rides the FilterBar's right slot, visually separate
 * from the filters.
 */
export function WorkFilterForm({
  filters,
  filterOptions,
  activeTab,
  sort,
  sortOptions,
  keepCreateOpen,
  activeFilterCount,
  clearFiltersHref,
}: WorkFilterFormProps) {
  const router = useRouter();
  // Plain string values are re-validated by normalizeWorkFilters on the server, so
  // the cast to the narrowed WorkFilterState is safe — option values come from the
  // model.
  const navigate = (key: keyof WorkFilterState, value: string) =>
    router.push(
      buildWorkHref({
        tab: activeTab,
        filters: { ...filters, [key]: value } as WorkFilterState,
        sort,
        create: keepCreateOpen,
      })
    );

  return (
    <FilterBar
      activeFilterCount={activeFilterCount}
      clearFiltersHref={clearFiltersHref}
      sortSlot={
        <WorkSortSelect sort={sort} options={sortOptions} activeTab={activeTab} filters={filters} />
      }
    >
      <FilterSelect
        label={WORK_FILTER_LABELS.owner}
        value={filters.owner}
        options={filterOptions.owners}
        onChange={(value) => navigate("owner", value)}
      />
      <FilterSelect
        label={WORK_FILTER_LABELS.dueDate}
        value={filters.dueDate}
        options={filterOptions.dueDates}
        onChange={(value) => navigate("dueDate", value)}
      />
      <FilterSelect
        label={WORK_FILTER_LABELS.contract}
        value={filters.contract}
        options={filterOptions.contracts}
        onChange={(value) => navigate("contract", value)}
      />
      <FilterSelect
        label={WORK_FILTER_LABELS.status}
        value={filters.status}
        options={filterOptions.statuses}
        onChange={(value) => navigate("status", value)}
      />
      <FilterSelect
        label={WORK_FILTER_LABELS.type}
        value={filters.type}
        options={filterOptions.types}
        onChange={(value) => navigate("type", value)}
      />
    </FilterBar>
  );
}
