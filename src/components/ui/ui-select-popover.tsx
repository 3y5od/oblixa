"use client";

import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from "react";
import { Check, Search } from "lucide-react";
import type { UiSelectOption } from "@/components/ui/ui-select-types";

export type UiSelectMenuPosition = {
  left: number;
  width: number;
  placement: "up" | "down";
  offset: number;
  maxHeight: number;
};

export function UiSelectPopover({
  popoverRef,
  menuRef,
  searchInputRef,
  portal,
  menuPos,
  menuWidth,
  showSearch,
  listboxId,
  ariaLabelledBy,
  buttonId,
  label,
  ariaLabel,
  visibleOptions,
  activeIndex,
  value,
  query,
  searchPlaceholder,
  emptyLabel,
  ulMaxHeight,
  setQuery,
  setActiveIndex,
  handleSearchKeyDown,
  commit,
}: {
  popoverRef: RefObject<HTMLDivElement | null>;
  menuRef: RefObject<HTMLUListElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  portal: boolean;
  menuPos: UiSelectMenuPosition | null;
  menuWidth: "trigger" | "fit";
  showSearch: boolean;
  listboxId: string;
  ariaLabelledBy?: string;
  buttonId: string;
  label?: string;
  ariaLabel?: string;
  visibleOptions: ReadonlyArray<UiSelectOption>;
  activeIndex: number;
  value: string;
  query: string;
  searchPlaceholder: string;
  emptyLabel: string;
  ulMaxHeight: number;
  setQuery: Dispatch<SetStateAction<string>>;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  handleSearchKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  commit: (value: string) => void;
}) {
  return (
    <div
      ref={popoverRef}
      style={
        portal && menuPos
          ? {
              position: "fixed",
              left: menuPos.left,
              width: menuWidth === "trigger" ? menuPos.width : undefined,
              minWidth: menuWidth === "trigger" ? undefined : menuPos.width,
              boxShadow:
                "0 2px 4px color-mix(in oklab, var(--text-primary) 16%, transparent), var(--shadow-3)",
              ...(menuPos.placement === "up"
                ? { bottom: menuPos.offset }
                : { top: menuPos.offset }),
            }
          : undefined
      }
      className={
        portal
          ? "z-50 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)]"
          : `absolute left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-2)] ${
              menuWidth === "trigger" ? "right-0" : "min-w-full"
            }`
      }
    >
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
              visibleOptions[activeIndex] ? `${buttonId}-opt-${activeIndex}` : undefined
            }
            aria-label={`Search ${label ?? ariaLabel ?? "options"}`}
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
        ref={menuRef}
        id={listboxId}
        role="listbox"
        aria-labelledby={ariaLabelledBy ?? buttonId}
        className="overflow-auto py-1"
        style={{ maxHeight: ulMaxHeight }}
      >
        {visibleOptions.length === 0 ? (
          <li
            role="presentation"
            className="px-3 py-2 text-[12.5px] text-[var(--text-tertiary)]"
          >
            {emptyLabel}
          </li>
        ) : (
          visibleOptions.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = showSearch && i === activeIndex;
            return (
              <li key={opt.value || `__${opt.label}`}>
                <button
                  type="button"
                  id={`${buttonId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  tabIndex={showSearch ? -1 : undefined}
                  onMouseEnter={showSearch ? () => setActiveIndex(i) : undefined}
                  onClick={() => {
                    if (opt.disabled) return;
                    commit(opt.value);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,transparent)] text-[var(--accent-strong)]"
                      : isActive
                        ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,transparent)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected ? (
                    <Check className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
