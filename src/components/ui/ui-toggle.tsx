"use client";

import { useId } from "react";
import type { ReactNode } from "react";

export interface UiToggleProps {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  ariaLabel?: string;
  size?: "sm" | "md";
}

export function UiToggle({
  name,
  checked,
  defaultChecked,
  disabled,
  onChange,
  label,
  description,
  ariaLabel,
  size = "md",
}: UiToggleProps) {
  const id = useId();
  const isControlled = checked !== undefined;

  const trackBase =
    size === "sm"
      ? "h-4 w-7 after:h-3 after:w-3 peer-checked:after:translate-x-3"
      : "h-5 w-9 after:h-3.5 after:w-3.5 peer-checked:after:translate-x-4";

  const toggle = (
    <span className="inline-flex items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        name={name}
        className="peer sr-only"
        checked={isControlled ? checked : undefined}
        defaultChecked={isControlled ? undefined : defaultChecked}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
      />
      <span
        aria-hidden
        className={`relative inline-flex shrink-0 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_78%,transparent)] transition-colors after:absolute after:left-0.5 after:top-0.5 after:rounded-full after:bg-[var(--text-tertiary)] after:transition-transform after:content-[''] peer-checked:border-[color:color-mix(in_oklab,var(--accent)_50%,var(--border-strong))] peer-checked:bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] peer-checked:after:bg-[var(--accent-strong)] peer-disabled:opacity-50 peer-focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_40%,transparent),0_0_0_4px_color-mix(in_oklab,var(--accent)_18%,transparent)] ${trackBase}`}
      />
      {label ? (
        <span className="inline-flex flex-col gap-0.5">
          <label
            htmlFor={id}
            className={`cursor-pointer text-[12.5px] font-medium ${
              disabled ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {label}
          </label>
          {description ? (
            <span className="text-[11px] leading-snug text-[var(--text-tertiary)]">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  return toggle;
}
