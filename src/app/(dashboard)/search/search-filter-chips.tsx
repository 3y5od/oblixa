"use client";

import { useEffect } from "react";
import { SEARCH_GROUP_LABELS, SEARCH_GROUP_ORDER, type SearchGroup } from "@/lib/navigation";

const CHIP_SHORTCUTS: Record<SearchGroup, string> = {
  pages: "1",
  queues: "2",
  reports: "3",
  tools: "4",
};

export function FilterChips({
  active,
  counts,
  showCounts,
  onChange,
}: {
  active: SearchGroup | null;
  counts: Map<SearchGroup, number>;
  showCounts: boolean;
  onChange: (group: SearchGroup | null) => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      for (const group of SEARCH_GROUP_ORDER) {
        if (event.key === CHIP_SHORTCUTS[group]) {
          event.preventDefault();
          onChange(active === group ? null : group);
          return;
        }
      }
      if (event.key === "0") {
        event.preventDefault();
        onChange(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filter by group">
      {SEARCH_GROUP_ORDER.map((group) => {
        const isActive = active === group;
        return (
          <button
            key={group}
            type="button"
            aria-pressed={isActive}
            aria-keyshortcuts={CHIP_SHORTCUTS[group]}
            onClick={() => onChange(isActive ? null : group)}
            className={`inline-flex min-h-[32px] min-w-[5rem] items-center justify-center rounded-full border px-3.5 py-1 text-[12.5px] font-semibold transition-[background-color,border-color,transform] motion-safe:active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:color-mix(in_oklab,var(--accent)_45%,transparent)] ${
              isActive
                ? "border-[color:color-mix(in_oklab,var(--accent)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,var(--surface))] text-[var(--accent-strong)]"
                : "border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {SEARCH_GROUP_LABELS[group]}
            {showCounts ? (
              <span className={`ml-1.5 tabular-nums text-[11px] font-medium ${isActive ? "text-[color:color-mix(in_oklab,var(--accent-strong)_75%,transparent)]" : "text-[var(--text-tertiary)]"}`}>
                <span className="sr-only">
                  {counts.get(group) ?? 0} result{(counts.get(group) ?? 0) === 1 ? "" : "s"}
                </span>
                <span aria-hidden>{counts.get(group) ?? 0}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
