"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { CountChip } from "@/components/ui/count-chip";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";

/**
 * The one filter-control recipe for every Core filter bar (Work, Renewals,
 * Evidence, Reports). A thin wrapper over `UiSelect` that locks the §7.3 dense
 * recipe so the four bars can never drift apart again: a `pill` trigger at a
 * fixed h-10, an inline caps label, the standardized active-filter tint, a
 * composed accessible name, and filter-as-you-type search on long lists.
 *
 * Selecting an option navigates immediately — the page maps `onChange` to
 * `router.push(buildHref(...))`. There is no Apply step.
 */

// Active filters get an accent-tinted trigger so a narrowed dimension reads at a
// glance, not only via the chips below. Applied inline because the base pill
// border/bg are utilities and an inline style is the only reliable override.
const ACTIVE_TINT: CSSProperties = {
  borderColor: "color-mix(in oklab, var(--accent) 42%, var(--border-subtle))",
  backgroundColor: "color-mix(in oklab, var(--accent) 7%, var(--surface-raised))",
};

export interface FilterSelectProps {
  /** Inline caps label shown in the trigger ("Owner", "Due within"). */
  label: string;
  /** Applied (URL) value — controlled. */
  value: string;
  options: ReadonlyArray<UiSelectOption>;
  /** Immediate navigate — the page maps this to `router.push(buildHref(...))`. */
  onChange: (value: string) => void;
  /** First-option fallback shown when the value is empty ("Any owner"). */
  placeholder?: string;
  /** Trigger width cap. Defaults to `max-w-[16rem]`; pass your own to override. */
  className?: string;
  menuWidth?: "trigger" | "fit";
  /** Override the active heuristic — needed for window filters whose default is
   *  not the first option (e.g. "90"). */
  active?: boolean;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  className,
  menuWidth = "fit",
  active,
}: FilterSelectProps) {
  const firstValue = options[0]?.value ?? "";
  const fallback = placeholder ?? options[0]?.label ?? `Any ${label.toLowerCase()}`;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? fallback;
  const isActive = active ?? (value !== "" && value !== firstValue);
  return (
    <UiSelect
      variant="pill"
      portal
      menuWidth={menuWidth}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={fallback}
      // Pair the dimension with its current value, so a screen-reader user hears
      // "Owner: Any owner" rather than a bare "Owner" that hides the selection.
      ariaLabel={`${label}: ${selectedLabel}`}
      // Long lists (owners, contracts, counterparties, obligations) get a
      // filter-as-you-type search row; short ones stay plain.
      searchThreshold={8}
      className={`min-w-0 ${className ?? "max-w-[16rem]"}`}
      buttonClassName="h-10 w-full min-w-0 justify-between"
      buttonStyle={isActive ? ACTIVE_TINT : undefined}
    />
  );
}

export interface FilterBarProps {
  /** The left-aligned filter group — a set of `<FilterSelect>` controls. */
  children: ReactNode;
  /** Count of active (non-default) filter dimensions; `>0` shows a "Filters N" chip. */
  activeFilterCount: number;
  /** Clears every filter back to defaults; the link shows only when count > 0. */
  clearFiltersHref?: string;
  /** Right-aligned, visually separate Sort control. */
  sortSlot?: ReactNode;
  /** Extra right-cluster content (e.g. Renewals' "N matches" confirmation). */
  rightExtra?: ReactNode;
  /** Per-page band chrome — border + padding, e.g. "border-t … px-5 py-3". */
  className?: string;
  /** Accessible name for the group landmark. Defaults to "Filters". */
  ariaLabel?: string;
}

export function FilterBar({
  children,
  activeFilterCount,
  clearFiltersHref,
  sortSlot,
  rightExtra,
  className,
  ariaLabel = "Filters",
}: FilterBarProps) {
  const showClear = activeFilterCount > 0 && Boolean(clearFiltersHref);
  const showRight = Boolean(rightExtra) || activeFilterCount > 0 || Boolean(sortSlot);
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`ui-filter-toolbar min-w-0 justify-between ${className ?? ""}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {showRight ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {rightExtra}
          {activeFilterCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Filters</span>
              <CountChip value={activeFilterCount} emphasis="strong" />
            </span>
          ) : null}
          {showClear ? (
            <Link
              href={clearFiltersHref as string}
              className="ui-btn-ghost inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[12.5px]"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Clear filters
            </Link>
          ) : null}
          {sortSlot ? (
            <>
              <span
                aria-hidden
                className="h-5 w-px bg-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]"
              />
              {sortSlot}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
