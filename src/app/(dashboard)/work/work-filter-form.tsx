"use client";

import { useState } from "react";
import Link from "next/link";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
import { WORK_FILTER_LABELS } from "@/lib/work/spec-strings";
import type { WorkFilterState, WorkPageModel, WorkSortKey } from "@/lib/work/types";

type WorkFilterFormProps = {
  /** The currently-applied filters (from the URL). */
  filters: WorkFilterState;
  filterOptions: WorkPageModel["filterOptions"];
  activeTab: WorkPageModel["activeTab"];
  /** Current sort, carried through the GET submit so applying filters keeps it. */
  sort: WorkSortKey;
  keepCreateOpen: boolean;
  /**
   * Pre-built href that drops every filter while preserving the active tab,
   * sort, and create state. Computed by the page via `buildWorkHref` and passed
   * in so this client form stays free of the server-side URL model. Drives the
   * in-toolbar reset affordance.
   */
  clearHref: string;
};

/**
 * The /work filter bar. Selects are controlled so we can compare the pending
 * selection against the applied filters and only enable Apply when something
 * actually changed — removing the "did my change take effect?" ambiguity of an
 * always-enabled submit. The parent remounts this via a key derived from the
 * applied filters, so navigating (Apply, a removed chip, Clear filters, or a
 * tab switch) resets the pending state back in sync with the URL.
 */
export function WorkFilterForm({
  filters,
  filterOptions,
  activeTab,
  sort,
  keepCreateOpen,
  clearHref,
}: WorkFilterFormProps) {
  // Plain strings — the GET submit is re-validated by normalizeWorkFilters on
  // the server, so the form doesn't need to carry the narrowed union types.
  const [pending, setPending] = useState<{
    owner: string;
    due: string;
    contract: string;
    status: string;
    type: string;
  }>({
    owner: filters.owner,
    due: filters.dueDate,
    contract: filters.contract,
    status: filters.status,
    type: filters.type,
  });

  const dirty =
    pending.owner !== filters.owner ||
    pending.due !== filters.dueDate ||
    pending.contract !== filters.contract ||
    pending.status !== filters.status ||
    pending.type !== filters.type;

  // Reset affordance keys off the APPLIED filters (the URL state), not the
  // pending selection — so "Clear filters" mirrors the active-chip strip and
  // stays stable while the user is mid-edit before applying.
  const hasActiveFilters =
    filters.owner !== "" ||
    filters.dueDate !== "" ||
    filters.contract !== "" ||
    filters.status !== "" ||
    filters.type !== "";

  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      {activeTab !== "all" ? <input type="hidden" name="tab" value={activeTab} /> : null}
      {sort !== "urgency" ? <input type="hidden" name="sort" value={sort} /> : null}
      {keepCreateOpen ? <input type="hidden" name="create" value="1" /> : null}
      <FilterSelect
        name="owner"
        label={WORK_FILTER_LABELS.owner}
        value={pending.owner}
        options={filterOptions.owners}
        onChange={(value) => setPending((prev) => ({ ...prev, owner: value }))}
      />
      <FilterSelect
        name="due"
        label={WORK_FILTER_LABELS.dueDate}
        value={pending.due}
        options={filterOptions.dueDates}
        onChange={(value) => setPending((prev) => ({ ...prev, due: value }))}
      />
      <FilterSelect
        name="contract"
        label={WORK_FILTER_LABELS.contract}
        value={pending.contract}
        options={filterOptions.contracts}
        onChange={(value) => setPending((prev) => ({ ...prev, contract: value }))}
      />
      <FilterSelect
        name="status"
        label={WORK_FILTER_LABELS.status}
        value={pending.status}
        options={filterOptions.statuses}
        onChange={(value) => setPending((prev) => ({ ...prev, status: value }))}
      />
      <FilterSelect
        name="type"
        label={WORK_FILTER_LABELS.type}
        value={pending.type}
        options={filterOptions.types}
        onChange={(value) => setPending((prev) => ({ ...prev, type: value }))}
      />
      <button
        type="submit"
        disabled={!dirty}
        className="inline-flex h-9 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)] bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--surface-raised))] px-4 text-[12.5px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--border-strong)_82%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Apply
      </button>
      {hasActiveFilters ? (
        <Link
          href={clearHref}
          className="inline-flex h-9 items-center justify-center rounded-full px-3 text-[12.5px] font-semibold text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,transparent)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const uiOptions: UiSelectOption[] = options.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  return (
    <UiSelect
      variant="pill"
      label={label}
      className="min-w-0"
      buttonClassName="h-9"
      name={name}
      value={value}
      onChange={onChange}
      options={uiOptions}
      placeholder={uiOptions[0]?.label ?? `Any ${label.toLowerCase()}`}
      ariaLabel={label}
      portal
    />
  );
}
