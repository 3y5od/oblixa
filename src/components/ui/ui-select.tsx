"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import type { DropdownOptionIcon, DropdownStatusTone } from "@/components/ui/dropdown/types";

export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  count?: number | string;
  statusDot?: DropdownStatusTone;
  icon?: DropdownOptionIcon;
}

export interface UiSelectProps {
  /** Optional form name — when set, a hidden input is rendered for form submission. */
  name?: string;
  /** Optional explicit id for the trigger button — lets an external `<label htmlFor>`
   *  or `aria-labelledby` associate with the control (needed for accessible-name
   *  resolution and label-driven test queries). Falls back to a generated id. */
  id?: string;
  /** Id of an external element labelling the control (e.g. a visible `<label>`). */
  ariaLabelledBy?: string;
  describedById?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: ReadonlyArray<UiSelectOption>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
  /** Inline style applied to the trigger button. Used for the active-filter tint,
   *  which must beat the base border/bg utilities reliably — utility-vs-utility
   *  override order is not guaranteed, but an inline style always wins. */
  buttonStyle?: CSSProperties;
  ariaLabel?: string;
  /** Optional caps prefix rendered inside the trigger — the §7.3 leading-label
   *  pill ("WINDOW  90 days"). Lets a dense toolbar drop separate stacked
   *  labels while keeping the control unmistakably custom (not a native box). */
  label?: string;
  /** Width of the popover menu. Defaults to matching the button width. */
  menuWidth?: "trigger" | "fit";
  /** Trigger chrome variant. `compact` matches `.ui-input-compact` (bordered
   *  box). `pill` matches §7.3 — a rounded-full pill trigger with leading
   *  caps-label + value, used in dense sidebars / overlay panels. */
  variant?: "compact" | "pill";
  /** Render the popover in a `document.body` portal with fixed positioning so it
   *  escapes ancestor `overflow-hidden` clipping (§7.3 / §11.12). Off by default
   *  to preserve the absolute-positioned behaviour of existing dense usages. */
  portal?: boolean;
  /** Show a filter-as-you-type search row above the options. When omitted, falls
   *  back to `options.length >= searchThreshold` ONLY if `searchThreshold` is set
   *  — so existing callers (no `search`, no `searchThreshold`) are unaffected. */
  search?: boolean;
  /** Auto-enable the search row when the option count reaches this number. Unset
   *  by default, so search never appears unless a caller opts in. */
  searchThreshold?: number;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Copy shown when a search query matches no options. */
  emptyLabel?: string;
}

export function UiSelect({
  name,
  id,
  ariaLabelledBy,
  describedById,
  value: controlledValue,
  defaultValue = "",
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  required,
  className,
  buttonClassName,
  buttonStyle,
  ariaLabel,
  label,
  menuWidth = "trigger",
  variant = "compact",
  portal = false,
  search,
  searchThreshold,
  searchPlaceholder = "Search…",
  emptyLabel = "No matches",
}: UiSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Highlighted option in the search-driven combobox model (aria-activedescendant).
  // Unused in the roving-focus model (no search), where DOM focus tracks the active
  // option directly.
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{
    left: number;
    width: number;
    placement: "up" | "down";
    offset: number;
    maxHeight: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The scrolling listbox — used to enumerate option buttons for roving-focus keys.
  const menuRef = useRef<HTMLUListElement>(null);
  // The whole popover (search row + listbox) — used for click-outside so clicking
  // the search input does not dismiss the menu.
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const listboxId = `${buttonId}-listbox`;

  const selected = options.find((o) => o.value === value);

  // Search appears when explicitly requested, or when a caller sets a threshold and
  // the list is long enough. Callers that pass neither keep the original behaviour.
  const showSearch =
    search ?? (typeof searchThreshold === "number" && options.length >= searchThreshold);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!showSearch || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, showSearch]);

  const computeMenuPos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const MENU_MAX = 264;
    const margin = 8;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    // Flip upward when the menu would overflow below the fold and there is more
    // room above — a `position: fixed` popover cannot be scrolled into view.
    const up = spaceBelow < MENU_MAX && spaceAbove > spaceBelow;
    return {
      left: r.left,
      width: r.width,
      placement: up ? ("up" as const) : ("down" as const),
      offset: up ? window.innerHeight - r.top + 6 : r.bottom + 6,
      maxHeight: Math.max(140, Math.min(MENU_MAX, up ? spaceAbove : spaceBelow)),
    };
  }, []);

  // Move focus into the search input when a searchable menu opens so the user can
  // type immediately (the §7.3 keyboard-first affordance).
  useEffect(() => {
    if (open && showSearch) searchInputRef.current?.focus();
  }, [open, showSearch]);

  // Keep the highlighted option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open || !showSearch) return;
    const node = document.getElementById(`${buttonId}-opt-${activeIndex}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [open, showSearch, activeIndex, buttonId]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      // Click-outside must exclude both the trigger wrapper and the (possibly
      // portaled) popover — otherwise a portaled option click would close the menu
      // on mousedown before its own click handler fires, and clicking the search
      // input would dismiss the menu (§7.3).
      if (wrapperRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key === "Tab") {
        // Let focus move on naturally, but close the popover (§7.3).
        setOpen(false);
        return;
      }
      // In the searchable model the input's own onKeyDown drives the highlight via
      // aria-activedescendant; the document-level roving handler stands down.
      if (showSearch) return;
      const opts = menuRef.current
        ? Array.from(
            menuRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])')
          )
        : [];
      if (opts.length === 0) return;
      const activeOpt = opts.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        (opts[activeOpt + 1] ?? opts[0]).focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        (opts[activeOpt - 1] ?? opts[opts.length - 1]).focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        opts[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        opts[opts.length - 1].focus();
      }
    }
    function handleViewportChange() {
      // A fixed-position portal popover must follow the trigger on scroll/resize.
      // Reposition (don't close) — closing on every scroll is too aggressive and
      // breaks interaction when a scroll is incidental (focus, trackpad inertia,
      // or a test harness scrolling an option into view).
      if (!portal) return;
      setMenuPos(computeMenuPos());
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open, portal, computeMenuPos, showSearch]);

  const toggle = () => {
    if (!open) {
      // Open fresh: clear any prior search query + highlight before showing the
      // popover (resetting here, not in a close effect, avoids cascading renders).
      setQuery("");
      setActiveIndex(0);
      if (portal) setMenuPos(computeMenuPos());
    }
    setOpen((o) => !o);
  };

  const commit = (v: string) => {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Search-input keyboard model: arrows/home/end move the highlight, Enter commits
  // it, while DOM focus stays in the input. Escape/Tab bubble to the document
  // handler which closes the menu.
  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(visibleOptions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(visibleOptions.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = visibleOptions[activeIndex];
      if (opt && !opt.disabled) commit(opt.value);
    }
  };

  const ulMaxHeight =
    portal && menuPos
      ? showSearch
        ? Math.max(96, menuPos.maxHeight - 44)
        : menuPos.maxHeight
      : 256;

  const popover = (
    <div
      ref={popoverRef}
      style={
        portal && menuPos
          ? {
              position: "fixed",
              left: menuPos.left,
              width: menuWidth === "trigger" ? menuPos.width : undefined,
              // Fit-width menus still anchor to at least the trigger width, so a
              // short-option popover (e.g. the renewals Review filter) never
              // renders as a too-narrow floating box misaligned with its trigger.
              minWidth: menuWidth === "trigger" ? undefined : menuPos.width,
              // Tight contact shadow over the ambient shadow-3, so the opaque
              // popover reads as clearly lifted above same-tone content beneath it
              // (e.g. a sticky table header directly below) instead of blending in.
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

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className ?? ""}`}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
          aria-hidden
        />
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        id={buttonId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={describedById}
        onClick={toggle}
        style={buttonStyle}
        className={`${
          variant === "pill"
            ? "inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-[12.5px] text-left transition-colors hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            : "ui-input-compact inline-flex w-full items-center justify-between gap-2 text-left"
        } disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName ?? ""}`}
      >
        {label ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="ui-caps-2 shrink-0 text-[9.5px] text-[var(--text-tertiary)]">
              {label}
            </span>
            <span
              title={selected?.label ?? placeholder}
              className={`truncate ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}
            >
              {selected?.label ?? placeholder}
            </span>
          </span>
        ) : (
          <span
            title={selected?.label ?? placeholder}
            className={`truncate ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}
          >
            {selected?.label ?? placeholder}
          </span>
        )}
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          strokeWidth={1.85}
          aria-hidden
        />
      </button>
      {open
        ? portal
          ? menuPos && typeof document !== "undefined"
            ? createPortal(popover, document.body)
            : null
          : popover
        : null}
    </div>
  );
}
