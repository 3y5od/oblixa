"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { UiSelect } from "@/components/ui/ui-select";

export interface ContractsSearchFormProps {
  initialSearch: string;
  initialDeadline: string;
  /** "activity" | "created" */
  initialSort: string;
  deadlineOptions: { value: string; label: string }[];
  /** Currently-set filter params to carry through a search/sort submit. */
  hidden: Record<string, string>;
}

/**
 * Search + date + sort + Apply, as one cohesive client form.
 *
 * Two behaviours the prior server-form couldn't express:
 *  - A leading search icon inside the field (§7.2).
 *  - `Apply` is disabled until search/date/sort actually diverge from the
 *    submitted values, so the button reads as "there are pending changes",
 *    not as decorative chrome. The selects are the custom `UiSelect`
 *    combobox (never a native <select>, §7.3), controlled so their values
 *    feed the dirty check and the GET submission alike.
 *
 * Rendered with `className="contents"` so its controls flow inline with the
 * sibling Filters / Saved-views popovers inside `.ui-filter-toolbar`.
 */
export function ContractsSearchForm({
  initialSearch,
  initialDeadline,
  initialSort,
  deadlineOptions,
  hidden,
}: ContractsSearchFormProps) {
  const [search, setSearch] = useState(initialSearch);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [sort, setSort] = useState(initialSort);

  const dirty =
    search.trim() !== initialSearch.trim() ||
    deadline !== initialDeadline ||
    sort !== initialSort;

  const selectChrome =
    "h-8 min-w-[9.5rem] rounded-md text-[12px] !border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] !bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,var(--surface-raised))] hover:!bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]";

  return (
    <form action="/contracts" method="get" className="contents">
      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-tertiary)]"
          aria-hidden
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.85} />
        </span>
        <input
          aria-label="Search contracts by name, counterparty, owner, or tag"
          id="contract-search"
          name="search"
          type="search"
          placeholder="Search contracts, counterparties, owners, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ui-input-compact h-8 w-full rounded-md pl-8 text-[12px]"
          autoComplete="off"
        />
      </div>
      <UiSelect
        name="deadline"
        value={deadline}
        onChange={setDeadline}
        ariaLabel="Date preset"
        placeholder="Any date"
        portal
        buttonClassName={selectChrome}
        options={deadlineOptions}
      />
      <UiSelect
        name="sort"
        value={sort}
        onChange={setSort}
        ariaLabel="Sort"
        portal
        buttonClassName={selectChrome}
        options={[
          { value: "activity", label: "Last activity" },
          { value: "created", label: "Last created" },
        ]}
      />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="page" value="1" />
      <button
        type="submit"
        disabled={!dirty}
        aria-label="Apply search, date, and sort"
        title={dirty ? "Apply (or press Enter)" : "No pending changes"}
        className={`inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-[12px] font-semibold transition-colors ${
          dirty
            ? "cursor-pointer border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] hover:border-[var(--accent-strong)] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            : "cursor-not-allowed border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_30%,transparent)] text-[var(--text-tertiary)]"
        }`}
      >
        Apply
      </button>
    </form>
  );
}
