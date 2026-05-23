"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { Search, X } from "lucide-react";

export interface UiSearchInputProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export function UiSearchInput({
  name,
  defaultValue,
  value,
  placeholder = "Search…",
  onChange,
  onClear,
  className,
  ariaLabel,
  autoFocus,
  compact = false,
}: UiSearchInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e.target.value);
  };

  const handleClear = () => {
    if (!isControlled) setInternalValue("");
    onChange?.("");
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
        strokeWidth={1.85}
        aria-hidden
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        name={name}
        defaultValue={isControlled ? undefined : defaultValue}
        value={isControlled ? value : undefined}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        className={`${compact ? "ui-input-compact" : "ui-input"} w-full pl-9 pr-9`}
      />
      {currentValue ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,transparent)] hover:text-[var(--text-primary)]"
        >
          <X className="h-3 w-3" strokeWidth={1.85} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
