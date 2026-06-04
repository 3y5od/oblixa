"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
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
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: ReadonlyArray<UiSelectOption>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
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
}

export function UiSelect({
  name,
  id,
  ariaLabelledBy,
  value: controlledValue,
  defaultValue = "",
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  required,
  className,
  buttonClassName,
  ariaLabel,
  label,
  menuWidth = "trigger",
  variant = "compact",
  portal = false,
}: UiSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    left: number;
    width: number;
    placement: "up" | "down";
    offset: number;
    maxHeight: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const buttonId = id ?? generatedId;

  const selected = options.find((o) => o.value === value);

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

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      // Click-outside must exclude both the trigger wrapper and the (possibly
      // portaled) menu — otherwise a portaled option click would close the menu
      // on mousedown before its own click handler fires (§7.3).
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
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
      const opts = menuRef.current
        ? Array.from(
            menuRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])')
          )
        : [];
      if (opts.length === 0) return;
      const activeIndex = opts.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        (opts[activeIndex + 1] ?? opts[0]).focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        (opts[activeIndex - 1] ?? opts[opts.length - 1]).focus();
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
  }, [open, portal, computeMenuPos]);

  const toggle = () => {
    if (!open && portal) setMenuPos(computeMenuPos());
    setOpen((o) => !o);
  };

  const commit = (v: string) => {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const optionList = (
    <ul
      ref={menuRef}
      role="listbox"
      aria-labelledby={ariaLabelledBy ?? buttonId}
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
              maxHeight: menuPos.maxHeight,
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
          ? "z-50 overflow-auto rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] py-1"
          : `absolute left-0 z-30 mt-1.5 max-h-64 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-2)] ${
              menuWidth === "trigger" ? "right-0" : "min-w-full"
            }`
      }
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <li key={opt.value || `__${opt.label}`}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                commit(opt.value);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,transparent)] text-[var(--accent-strong)]"
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
      })}
    </ul>
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
        onClick={toggle}
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
            ? createPortal(optionList, document.body)
            : null
          : optionList
        : null}
    </div>
  );
}
