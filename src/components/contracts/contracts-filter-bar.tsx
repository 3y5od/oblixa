"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
import { buildContractsListHref } from "@/lib/contracts-search-url";

/**
 * The contracts inventory filter bar, on the shared §7.3 FilterBar recipe used by
 * Work/Renewals/Evidence/Reports. Replaces the bespoke search-form + Apply button
 * + two PortaledPopovers: search is the leading wide control, the dimensions are
 * inline FilterSelect pills, sort sits in the right cluster, and the (server-
 * rendered) saved-views control rides in `rightExtra` — one coherent area instead
 * of three detached button groups. Every control navigates immediately; there is
 * no Apply step. Operational filters (exceptions / review / data_quality /
 * evidence / work / health) are not pills here — they live in the quick-filter
 * strip + the applied-filter chips — but they ride along on every navigation so
 * changing a dimension never drops them.
 */

export interface ContractsFilterValues {
  search: string;
  status: string;
  owner: string;
  counterparty: string;
  contract_type: string;
  region: string;
  deadline: string;
  sort: string;
  // Preserved across navigations (surfaced via quick filters / applied chips).
  exceptions: string;
  review: string;
  data_quality: string;
  evidence: string;
  work: string;
  health: string;
}

export interface ContractsFilterBarProps {
  values: ContractsFilterValues;
  /** Real status options (no leading "Any"); the bar prepends the clear option. */
  statusOptions: ReadonlyArray<{ value: string; label: string }>;
  ownerOptions: ReadonlyArray<{ value: string; label: string }>;
  counterpartyOptions: ReadonlyArray<{ value: string; label: string }>;
  contractTypeOptions: ReadonlyArray<{ value: string; label: string }>;
  deadlineOptions: ReadonlyArray<{ value: string; label: string }>;
  activeFilterCount: number;
  /** The saved-views control (server-rendered popover), placed in the right cluster. */
  savedViewsSlot?: ReactNode;
}

const SORT_OPTIONS: UiSelectOption[] = [
  { value: "activity", label: "Last updated" },
  { value: "created", label: "Last created" },
];

const FILTER_PILL_HEIGHT = "h-[42px]";

// Prepend a leading "Any …" clear option (value ""). The "Any …" label lets the
// FilterSelect dedup it at rest (pill reads "OWNER", not "OWNER Any owner") while
// still offering an explicit "clear this dimension" row in the dropdown.
function withClearOption(
  label: string,
  options: ReadonlyArray<{ value: string; label: string }>
): UiSelectOption[] {
  return [
    { value: "", label: `Any ${label.toLowerCase()}` },
    ...options.filter((o) => o.value !== ""),
  ];
}

export function ContractsFilterBar({
  values,
  statusOptions,
  ownerOptions,
  counterpartyOptions,
  contractTypeOptions,
  deadlineOptions,
  activeFilterCount,
  savedViewsSlot,
}: ContractsFilterBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(values.search);
  const currentSort = values.sort || "activity";

  // Every navigation rebuilds the full param set so changing one dimension never
  // drops the others, and always resets to page 1.
  function navigate(overrides: Partial<ContractsFilterValues>) {
    const next = { ...values, ...overrides };
    router.push(
      buildContractsListHref({
        search: next.search || undefined,
        status: next.status || undefined,
        owner: next.owner || undefined,
        counterparty: next.counterparty || undefined,
        contract_type: next.contract_type || undefined,
        region: next.region || undefined,
        deadline: next.deadline || undefined,
        // "activity" is the default sort, so it carries no query param.
        sort: next.sort && next.sort !== "activity" ? next.sort : undefined,
        exceptions: next.exceptions || undefined,
        review: next.review || undefined,
        data_quality: next.data_quality || undefined,
        evidence: next.evidence || undefined,
        work: next.work || undefined,
        health: next.health || undefined,
        page: undefined,
      })
    );
  }

  return (
    <FilterBar
      ariaLabel="Filter contracts"
      activeFilterCount={activeFilterCount}
      clearFiltersHref="/contracts"
      sortSlot={
        <UiSelect
          variant="pill"
          portal
          label="Sort"
          value={currentSort}
          onChange={(value) => navigate({ sort: value })}
          options={SORT_OPTIONS}
          ariaLabel={`Sort: ${
            SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? "Last updated"
          }`}
          className="w-[10.5rem]"
          buttonClassName={`${FILTER_PILL_HEIGHT} justify-between`}
        />
      }
      rightExtra={savedViewsSlot}
    >
      <div className="min-w-[10rem] flex-[1_1_11rem]">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ search: search.trim() });
          }}
          className="relative min-w-0"
        >
          <span
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
            aria-hidden
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.85} />
          </span>
          <input
            aria-label="Search contracts by name, counterparty, owner, or tag"
            type="search"
            placeholder="Search contracts, counterparties, owners, tags…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            // Enter applies — no separate Apply button (immediate-apply recipe).
            className={`ui-input-compact ${FILTER_PILL_HEIGHT} w-full rounded-md pl-9 text-[12.5px]`}
            autoComplete="off"
          />
        </form>
      </div>
      <FilterSelect
        label="Status"
        value={values.status}
        options={withClearOption("Status", statusOptions)}
        onChange={(value) => navigate({ status: value })}
        className="w-[7.5rem]"
        labelOnlyWhenInactive
      />
      <FilterSelect
        label="Owner"
        value={values.owner}
        options={withClearOption("Owner", ownerOptions)}
        onChange={(value) => navigate({ owner: value })}
        className="w-[8.5rem]"
        labelOnlyWhenInactive
      />
      <FilterSelect
        label="Counterparty"
        value={values.counterparty}
        options={withClearOption("Counterparty", counterpartyOptions)}
        onChange={(value) => navigate({ counterparty: value })}
        className="w-[11rem]"
        labelOnlyWhenInactive
      />
      <FilterSelect
        label="Type"
        value={values.contract_type}
        options={withClearOption("Type", contractTypeOptions)}
        onChange={(value) => navigate({ contract_type: value })}
        className="w-[7rem]"
        labelOnlyWhenInactive
      />
      <FilterSelect
        label="Date"
        value={values.deadline}
        options={withClearOption("Date", deadlineOptions)}
        onChange={(value) => navigate({ deadline: value })}
        className="w-[7rem]"
        labelOnlyWhenInactive
      />
    </FilterBar>
  );
}
