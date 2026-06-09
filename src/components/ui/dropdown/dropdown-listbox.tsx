"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Search } from "lucide-react";
import type { UiSelectOption } from "./types";
import { DropdownOptionRow } from "./dropdown-option-row";
import { DropdownEmptyState } from "./dropdown-empty-state";
import { moveRovingFocus, nextActiveIndex } from "./dropdown-keyboard";

/**
 * The listbox body shared by every select-style dropdown: an optional sticky
 * search row + the `role="listbox"` option list. Owns its own search query and
 * highlighted index, so it resets cleanly each time it is mounted (popovers
 * unmount on close). The OVERLAY concerns — open/close, positioning, portal,
 * outside-click, Escape/Tab — stay with the host (`UiSelect`), which renders
 * this inside its popover surface and passes `onCommit`.
 *
 * Two keyboard models, exactly as before:
 * - No search → roving DOM focus over the option buttons via a document-level
 *   handler (so arrows work even while the trigger is focused).
 * - Search → focus stays in the input; ArrowUp/Down/Home/End move an index and
 *   Enter commits it (aria-activedescendant). Escape/Tab bubble to the host.
 */
export interface DropdownListboxProps {
  options: ReadonlyArray<UiSelectOption>;
  value: string;
  onCommit: (value: string) => void;
  /** Id for the `<ul role="listbox">` (the trigger points at it via controls). */
  listboxId: string;
  /** Id prefix for option elements + aria-activedescendant targets. */
  idPrefix: string;
  /** Element labelling the listbox (the trigger id or an external label id). */
  ariaLabelledBy: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  emptyLabel?: string;
  /** Max height applied to the scrolling option list. */
  maxHeight?: number;
}

export function DropdownListbox({
  options,
  value,
  onCommit,
  listboxId,
  idPrefix,
  ariaLabelledBy,
  showSearch = false,
  searchPlaceholder = "Search…",
  searchAriaLabel = "Search options",
  emptyLabel = "No matches",
  maxHeight = 256,
}: DropdownListboxProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const ulRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!showSearch || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, showSearch]);

  // Type immediately when a searchable menu opens (§7.3 keyboard-first).
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  // Keep the highlighted option in view during search-model navigation.
  useEffect(() => {
    if (!showSearch) return;
    document
      .getElementById(`${idPrefix}-opt-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [showSearch, activeIndex, idPrefix]);

  // Roving-focus model (no search): a document-level handler so the arrows work
  // even while the trigger holds focus. Escape/Tab are owned by the host.
  useEffect(() => {
    if (showSearch) return;
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        if (moveRovingFocus(ulRef.current, e.key, '[role="option"]:not([disabled])')) {
          e.preventDefault();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showSearch]);

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const idx = nextActiveIndex(e.key, activeIndex, visibleOptions.length);
    if (idx !== null) {
      e.preventDefault();
      setActiveIndex(idx);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = visibleOptions[activeIndex];
      if (opt && !opt.disabled) onCommit(opt.value);
    }
  };

  // Flatten into render rows, tagging the first option of each group so a caps
  // section header renders above it. Index `i` (position in visibleOptions) is
  // the stable id/activedescendant key and matches DOM order for roving.
  let lastGroup: string | undefined;
  const rows = visibleOptions.map((opt, i) => {
    const headerLabel = opt.group && opt.group !== lastGroup ? opt.group : null;
    lastGroup = opt.group;
    return { opt, i, headerLabel };
  });

  return (
    <>
      {showSearch ? (
        <div className="flex items-center gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-3 py-2">
          <Search
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
            strokeWidth={1.85}
            aria-hidden
          />
          <input
            ref={searchInputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              visibleOptions[activeIndex] ? `${idPrefix}-opt-${activeIndex}` : undefined
            }
            aria-label={searchAriaLabel}
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            className="w-full bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
        </div>
      ) : null}
      <ul
        ref={ulRef}
        id={listboxId}
        role="listbox"
        aria-labelledby={ariaLabelledBy}
        className="space-y-0.5 overflow-auto overscroll-contain p-1.5"
        style={{ maxHeight }}
      >
        {visibleOptions.length === 0 ? (
          <DropdownEmptyState label={emptyLabel} />
        ) : (
          rows.map(({ opt, i, headerLabel }) => {
            const isSelected = opt.value === value;
            const isActive = showSearch && i === activeIndex;
            // A real but empty facet (count 0) reads quieter — present and still
            // selectable (§2.11 tone-tinted-zero), never disabled/hidden.
            const isEmpty = opt.count === 0;
            return (
              <Fragment key={opt.value || `__${opt.label}`}>
                {headerLabel ? (
                  <li
                    role="presentation"
                    className="ui-caps-2 px-2.5 pb-1 pt-2 text-[9.5px] text-[var(--text-tertiary)]"
                  >
                    {headerLabel}
                  </li>
                ) : null}
                <li>
                  <button
                    type="button"
                    id={`${idPrefix}-opt-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    tabIndex={showSearch ? -1 : undefined}
                    onMouseEnter={showSearch ? () => setActiveIndex(i) : undefined}
                    onClick={() => {
                      if (opt.disabled) return;
                      onCommit(opt.value);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? "text-[var(--accent-strong)]"
                        : isActive
                          ? "bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] hover:text-[var(--text-primary)] focus-visible:bg-[color:color-mix(in_oklab,var(--surface-muted)_70%,transparent)] focus-visible:text-[var(--text-primary)]"
                    } ${isEmpty && !isSelected ? "opacity-55" : ""}`}
                    // Selected rows carry an accent wash + a subtle inset left
                    // rail — a clearer "this one" cue than a flat full-row slab.
                    style={
                      isSelected
                        ? {
                            backgroundColor:
                              "color-mix(in oklab, var(--accent-soft) 34%, transparent)",
                            boxShadow: "inset 2px 0 0 0 var(--accent-strong)",
                          }
                        : undefined
                    }
                  >
                    <DropdownOptionRow
                      selected={isSelected}
                      label={opt.label}
                      description={opt.description}
                      count={opt.count}
                      statusDot={opt.statusDot}
                      icon={opt.icon}
                    />
                  </button>
                </li>
              </Fragment>
            );
          })
        )}
      </ul>
    </>
  );
}
