"use client";

import { useRouter } from "next/navigation";
import { CountChip } from "@/components/ui/count-chip";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { type UiSelectOption } from "@/components/ui/ui-select";
import type { DropdownStatusTone } from "@/components/ui/dropdown";

type FilterOption = { value: string; label: string };

// In-panel status dots (§2.5) for the renewals STATUS list — tone follows the
// model's urgency order (notice_window_open most urgent, completed least).
// Rendered only inside the open list (DropdownOptionRow); the closed pill stays
// neutral and "Any status" (value "") carries no dot.
const RENEWAL_STATUS_DOT: Record<string, DropdownStatusTone> = {
  notice_window_open: "danger",
  needs_owner: "warning",
  needs_review: "warning",
  in_progress: "neutral",
  no_renewal_action_needed: "neutral",
  completed: "success",
};

// Review-state provenance dots: a human-approved value reads as trusted, an
// unapproved suggestion wants attention, derived/absent values stay quiet.
const RENEWAL_REVIEW_DOT: Record<string, DropdownStatusTone> = {
  reviewed: "success",
  suggested: "warning",
  computed: "neutral",
  missing: "neutral",
};

export interface RenewalFilterBarProps {
  activeWindow: string;
  filters: { owner: string; counterparty: string; status: string; review: string };
  labels: { owner: string; counterparty: string; status: string; review: string };
  /** Window options carry their per-horizon count in the label, e.g. "60 days (5)". */
  windowOptions: FilterOption[];
  ownerOptions: FilterOption[];
  counterpartyOptions: FilterOption[];
  statusOptions: FilterOption[];
  reviewOptions: FilterOption[];
  /** Preserve the create-task panel across a filter navigation. */
  keepCreateOpen: boolean;
  /** Rows matching the current filters — shown as compact confirmation feedback. */
  matchCount: number;
}

/**
 * Renewals filter toolbar — composed from the shared `FilterBar` / `FilterSelect`
 * (§7.3 / §8) so it shares one pill recipe, height, label style, active tint, and
 * immediate-apply behaviour with Work, Evidence, and Reports. Every control —
 * including the "Due within" horizon — is a custom combobox (never a native
 * select); selecting any option navigates immediately, so there is no Apply step.
 * A compact match count confirms how many rows the filters narrowed to.
 */
export function RenewalFilterBar({
  activeWindow,
  filters,
  labels,
  windowOptions,
  ownerOptions,
  counterpartyOptions,
  statusOptions,
  reviewOptions,
  keepCreateOpen,
  matchCount,
}: RenewalFilterBarProps) {
  const router = useRouter();
  const activeFilterCount = [
    filters.owner,
    filters.counterparty,
    filters.status,
    filters.review,
  ].filter(Boolean).length;
  const hasFilters = activeFilterCount > 0;

  // Decorate the data-driven options with their tone dot (a presentation concern,
  // so the server model stays a pure {value,label}).
  const statusFilterOptions: UiSelectOption[] = statusOptions.map((option) =>
    option.value ? { ...option, statusDot: RENEWAL_STATUS_DOT[option.value] } : option
  );
  const reviewFilterOptions: UiSelectOption[] = reviewOptions.map((option) =>
    option.value ? { ...option, statusDot: RENEWAL_REVIEW_DOT[option.value] } : option
  );

  function navigate(
    next: Partial<{ window: string; owner: string; counterparty: string; status: string; review: string }>
  ) {
    const window = next.window ?? activeWindow;
    const owner = next.owner ?? filters.owner;
    const counterparty = next.counterparty ?? filters.counterparty;
    const status = next.status ?? filters.status;
    const review = next.review ?? filters.review;
    router.push(buildHref({ window, owner, counterparty, status, review }));
  }

  // Mirror buildRenewalsHref: 90 is the default horizon, so it stays out of the URL.
  function buildHref(state: {
    window: string;
    owner: string;
    counterparty: string;
    status: string;
    review: string;
  }) {
    const params = new URLSearchParams();
    if (state.window && state.window !== "90") params.set("window", state.window);
    if (state.owner) params.set("owner", state.owner);
    if (state.counterparty) params.set("counterparty", state.counterparty);
    if (state.status) params.set("status", state.status);
    if (state.review) params.set("review", state.review);
    if (keepCreateOpen) params.set("create", "1");
    const qs = params.toString();
    return qs ? `/renewals?${qs}` : "/renewals";
  }

  // Clear resets the attribute filters but keeps the selected horizon.
  const clearFiltersHref = buildHref({
    window: activeWindow,
    owner: "",
    counterparty: "",
    status: "",
    review: "",
  });

  return (
    <FilterBar
      className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3"
      activeFilterCount={activeFilterCount}
      clearFiltersHref={clearFiltersHref}
      rightExtra={
        hasFilters ? (
          <span className="inline-flex items-center gap-1.5">
            <CountChip value={matchCount} emphasis="subtle" />
            <span className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">
              {matchCount === 1 ? "match" : "matches"}
            </span>
          </span>
        ) : null
      }
    >
      {/* Short "Due" label — the two-token pill always shows the caps label
          beside the value ("DUE │ 90 days"), so the dimension self-identifies
          without the longer "Due within". Its default (90) isn't the first
          option, so the active tint is driven explicitly. */}
      <FilterSelect
        label="Due"
        value={activeWindow}
        options={windowOptions}
        onChange={(value) => navigate({ window: value })}
        active={activeWindow !== "90"}
      />
      <FilterSelect
        label={labels.owner}
        value={filters.owner}
        options={ownerOptions}
        onChange={(value) => navigate({ owner: value })}
      />
      <FilterSelect
        label={labels.counterparty}
        value={filters.counterparty}
        options={counterpartyOptions}
        onChange={(value) => navigate({ counterparty: value })}
      />
      <FilterSelect
        label={labels.status}
        value={filters.status}
        options={statusFilterOptions}
        onChange={(value) => navigate({ status: value })}
      />
      <FilterSelect
        label={labels.review}
        value={filters.review}
        options={reviewFilterOptions}
        onChange={(value) => navigate({ review: value })}
      />
    </FilterBar>
  );
}
