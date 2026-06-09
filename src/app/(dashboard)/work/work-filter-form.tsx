"use client";

import { useRouter } from "next/navigation";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { type UiSelectOption } from "@/components/ui/ui-select";
import type { DropdownStatusTone } from "@/components/ui/dropdown";
import { buildWorkHref } from "@/lib/work/model";
import { WORK_FILTER_LABELS } from "@/lib/work/spec-strings";
import type { WorkFilterState, WorkOption, WorkPageModel, WorkSortKey } from "@/lib/work/types";
import { WorkSortSelect } from "./work-sort-select";

// In-panel status dots (§2.5): waiting tasks read as a problem, waiting wants
// attention, done is resolved; open/in-progress/canceled stay quiet. Due dots
// mirror Evidence (overdue danger, due-today/soon warning). Shown only inside
// the open list (DropdownOptionRow); the closed pill and the value-"" default
// option carry none.
const WORK_STATUS_DOT: Record<string, DropdownStatusTone> = {
  blocked: "danger",
  waiting: "warning",
  done: "success",
  open: "neutral",
  in_progress: "neutral",
  canceled: "neutral",
};
const WORK_DUE_DOT: Record<string, DropdownStatusTone> = {
  overdue: "danger",
  due_today: "warning",
  due_soon: "warning",
  no_due: "neutral",
};

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

  // Decorate the data-driven options with their tone dot (a presentation concern,
  // so the server model stays a pure {value,label}).
  const statusOptions: UiSelectOption[] = filterOptions.statuses.map((option) =>
    option.value ? { ...option, statusDot: WORK_STATUS_DOT[option.value] } : option
  );
  const dueOptions: UiSelectOption[] = filterOptions.dueDates.map((option) =>
    option.value ? { ...option, statusDot: WORK_DUE_DOT[option.value] } : option
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
        options={dueOptions}
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
        options={statusOptions}
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
