"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface UiSelectProps {
  /** Optional form name — when set, a hidden input is rendered for form submission. */
  name?: string;
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
  /** Width of the popover menu. Defaults to matching the button width. */
  menuWidth?: "trigger" | "fit";
}

export function UiSelect({
  name,
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
  menuWidth = "trigger",
}: UiSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const commit = (v: string) => {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
    setOpen(false);
    buttonRef.current?.focus();
  };

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
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`ui-input-compact inline-flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName ?? ""}`}
      >
        <span
          className={`truncate ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          strokeWidth={1.85}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-labelledby={id}
          className={`absolute left-0 z-30 mt-1.5 max-h-64 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-2)] ${
            menuWidth === "trigger" ? "right-0" : "min-w-full"
          }`}
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
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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
      ) : null}
    </div>
  );
}
