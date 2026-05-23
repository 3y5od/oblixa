"use client";

import { useId, useState } from "react";

export interface UiRadioOption {
  value: string;
  label: string;
}

export interface UiRadioGroupProps {
  name: string;
  options: ReadonlyArray<UiRadioOption>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function UiRadioGroup({
  name,
  options,
  value: controlledValue,
  defaultValue = "",
  onChange,
  ariaLabel,
  className,
}: UiRadioGroupProps) {
  const id = useId();
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  const setValue = (v: string) => {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-1.5 ${className ?? ""}`}
    >
      {options.map((opt) => {
        const inputId = `${id}-${opt.value || "all"}`;
        return (
          <label key={opt.value || "all"} className="cursor-pointer" htmlFor={inputId}>
            <input
              id={inputId}
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => setValue(opt.value)}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-8 items-center rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_38%,transparent)] px-3 py-1 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] hover:text-[var(--text-primary)] peer-checked:border-[color:color-mix(in_oklab,var(--accent)_60%,var(--border-strong))] peer-checked:bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] peer-checked:text-[var(--accent-strong)] peer-checked:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_28%,transparent)] peer-focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_40%,transparent),0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)]">
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
