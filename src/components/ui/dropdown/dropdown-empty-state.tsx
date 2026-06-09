"use client";

import { SearchX } from "lucide-react";

/**
 * Consistent empty state for searchable dropdowns: icon + "No matches" + an
 * optional reset action. Renders an `<li>` so it can sit directly inside the
 * listbox `<ul>`. Replaces the prior bare tertiary-text line.
 */
export interface DropdownEmptyStateProps {
  label?: string;
  onReset?: () => void;
  resetLabel?: string;
}

export function DropdownEmptyState({
  label = "No matches",
  onReset,
  resetLabel = "Clear search",
}: DropdownEmptyStateProps) {
  return (
    <li
      role="presentation"
      className="flex flex-col items-center gap-1.5 px-3 py-6 text-center"
    >
      <SearchX
        className="h-4 w-4 text-[var(--text-tertiary)]"
        strokeWidth={1.85}
        aria-hidden
      />
      <span className="text-[12px] text-[var(--text-tertiary)]">{label}</span>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="ui-caps-2 text-[10px] text-[var(--accent-strong)] hover:underline"
        >
          {resetLabel}
        </button>
      ) : null}
    </li>
  );
}
