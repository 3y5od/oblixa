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
import { ChevronDown } from "lucide-react";
import type { UiSelectOption } from "@/components/ui/ui-select-types";
import { UiSelectPopover, type UiSelectMenuPosition } from "@/components/ui/ui-select-popover";

export type { UiSelectOption };

export interface UiSelectProps {
  name?: string;
  id?: string;
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
  buttonStyle?: CSSProperties;
  ariaLabel?: string;
  label?: string;
  menuWidth?: "trigger" | "fit";
  variant?: "compact" | "pill";
  /** Marks the trigger as a narrowed/active filter so the value renders in accent
   *  ink (paired with the caller's active tint). No effect unless `label` is set. */
  active?: boolean;
  portal?: boolean;
  search?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
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
  active = false,
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<UiSelectMenuPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const listboxId = `${buttonId}-listbox`;

  const selected = options.find((o) => o.value === value);
  // Value-forward triggers: an empty value is the cleared/placeholder state, so
  // the trigger shows the dimension `label` until a real value is picked.
  const cleared = !value;

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
    const up = spaceBelow < MENU_MAX && spaceAbove > spaceBelow;
    return {
      left: r.left,
      width: r.width,
      placement: up ? ("up" as const) : ("down" as const),
      offset: up ? window.innerHeight - r.top + 6 : r.bottom + 6,
      maxHeight: Math.max(140, Math.min(MENU_MAX, up ? spaceAbove : spaceBelow)),
    };
  }, []);

  useEffect(() => {
    if (open && showSearch) searchInputRef.current?.focus();
  }, [open, showSearch]);

  useEffect(() => {
    if (!open || !showSearch) return;
    const node = document.getElementById(`${buttonId}-opt-${activeIndex}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [open, showSearch, activeIndex, buttonId]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
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
        setOpen(false);
        return;
      }
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
    <UiSelectPopover
      popoverRef={popoverRef}
      menuRef={menuRef}
      searchInputRef={searchInputRef}
      portal={portal}
      menuPos={menuPos}
      menuWidth={menuWidth}
      showSearch={showSearch}
      listboxId={listboxId}
      ariaLabelledBy={ariaLabelledBy}
      buttonId={buttonId}
      label={label}
      ariaLabel={ariaLabel}
      visibleOptions={visibleOptions}
      activeIndex={activeIndex}
      value={value}
      query={query}
      searchPlaceholder={searchPlaceholder}
      emptyLabel={emptyLabel}
      ulMaxHeight={ulMaxHeight}
      setQuery={setQuery}
      setActiveIndex={setActiveIndex}
      handleSearchKeyDown={handleSearchKeyDown}
      commit={commit}
    />
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
            ? "inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-[12.5px] text-left transition-colors hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            : "ui-input-compact inline-flex w-full items-center justify-between gap-2 text-left"
        } disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName ?? ""}`}
      >
        {label ? (
          // Value-forward (§dropdowns): one type register — the dimension name
          // while cleared, the chosen value (accent ink when narrowing) once set.
          // No tiny caps eyebrow stacked against a larger value.
          <span
            title={cleared ? label : (selected?.label ?? label)}
            className={`truncate ${
              active
                ? "font-medium text-[var(--accent-strong)]"
                : cleared
                  ? "text-[var(--text-tertiary)]"
                  : "font-medium text-[var(--text-primary)]"
            }`}
          >
            {cleared ? label : (selected?.label ?? label)}
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
