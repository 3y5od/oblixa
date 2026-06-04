"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { CountChip } from "@/components/ui/count-chip";
import { UiSelect } from "@/components/ui/ui-select";

type FilterOption = { value: string; label: string };

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
 * Unified renewals filter toolbar (§7.3 / §8). Every control — including the
 * "Due within" horizon — is a custom UiSelect combobox (never a native select
 * element), so the row reads as one aligned band of stable-width pills with a
 * real trigger / chevron / value / hover / focus state. Selecting any option
 * navigates immediately (client-side), so there is no separate Apply step and the
 * horizon stays as instant as the old segmented control. Active filters carry an
 * accent-tinted trigger; a Reset clears the attribute filters; a compact count
 * confirms how many rows matched.
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
  const hasFilters = Boolean(filters.owner || filters.counterparty || filters.status || filters.review);

  function navigate(next: Partial<{ window: string; owner: string; counterparty: string; status: string; review: string }>) {
    const window = next.window ?? activeWindow;
    const owner = next.owner ?? filters.owner;
    const counterparty = next.counterparty ?? filters.counterparty;
    const status = next.status ?? filters.status;
    const review = next.review ?? filters.review;
    const params = new URLSearchParams();
    // Mirror buildRenewalsHref: 90 is the default horizon, so it stays out of the URL.
    if (window && window !== "90") params.set("window", window);
    if (owner) params.set("owner", owner);
    if (counterparty) params.set("counterparty", counterparty);
    if (status) params.set("status", status);
    if (review) params.set("review", review);
    if (keepCreateOpen) params.set("create", "1");
    const qs = params.toString();
    router.push(qs ? `/renewals?${qs}` : "/renewals");
  }

  // §7.3 — stable per-control width keeps the toolbar from reflowing as values
  // change; min-w-0 + the UiSelect's internal truncate keep long owner /
  // counterparty values from blowing out the row.
  const triggerBase = "h-9 w-full min-w-0 justify-between";
  function triggerClass(active: boolean) {
    return active
      ? `${triggerBase} border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent)_7%,var(--surface-raised))]`
      : triggerBase;
  }

  return (
    <div className="ui-filter-toolbar min-w-0 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3">
      <span className="ui-caps-2 pr-0.5 text-[11px] text-[var(--text-tertiary)]">Filter</span>

      {/* The horizon keeps an explicit inline "Due within" caps label since its
          values ("90 days") don't self-identify as a filter dimension. */}
      <div className="w-[11rem] min-w-0 shrink-0">
        <UiSelect
          label="Due within"
          ariaLabel="Due within"
          value={activeWindow}
          options={windowOptions}
          onChange={(value) => navigate({ window: value })}
          portal
          menuWidth="fit"
          className="block w-full"
          buttonClassName={triggerBase}
        />
      </div>

      {/* The attribute filters self-label through their "Any owner / Any status …"
          default option, so they drop the inline caps label (keeping ariaLabel for
          assistive tech) and stay narrow; an accent-tinted trigger marks an active
          filter so the selected state is unmistakable. */}
      <div className="w-[9.5rem] min-w-0 shrink-0">
        <UiSelect
          ariaLabel={labels.owner}
          value={filters.owner}
          options={ownerOptions}
          onChange={(value) => navigate({ owner: value })}
          portal
          menuWidth="fit"
          className="block w-full"
          buttonClassName={triggerClass(Boolean(filters.owner))}
        />
      </div>

      <div className="w-[10.5rem] min-w-0 shrink-0">
        <UiSelect
          ariaLabel={labels.counterparty}
          value={filters.counterparty}
          options={counterpartyOptions}
          onChange={(value) => navigate({ counterparty: value })}
          portal
          menuWidth="fit"
          className="block w-full"
          buttonClassName={triggerClass(Boolean(filters.counterparty))}
        />
      </div>

      <div className="w-[11rem] min-w-0 shrink-0">
        <UiSelect
          ariaLabel={labels.status}
          value={filters.status}
          options={statusOptions}
          onChange={(value) => navigate({ status: value })}
          portal
          menuWidth="fit"
          className="block w-full"
          buttonClassName={triggerClass(Boolean(filters.status))}
        />
      </div>

      <div className="w-[10rem] min-w-0 shrink-0">
        <UiSelect
          ariaLabel={labels.review}
          value={filters.review}
          options={reviewOptions}
          onChange={(value) => navigate({ review: value })}
          portal
          menuWidth="fit"
          className="block w-full"
          buttonClassName={triggerClass(Boolean(filters.review))}
        />
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => navigate({ owner: "", counterparty: "", status: "", review: "" })}
          className="ui-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12.5px]"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          Reset
        </button>
      ) : null}

      {/* Compact match feedback — only while filters are active, so it confirms the
          narrowing without tripling the count that already rides the section header
          and the sticky list footer. */}
      {hasFilters ? (
        <span className="ml-auto inline-flex items-center gap-1.5">
          <CountChip value={matchCount} emphasis="subtle" />
          <span className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">
            {matchCount === 1 ? "match" : "matches"}
          </span>
        </span>
      ) : null}
    </div>
  );
}
