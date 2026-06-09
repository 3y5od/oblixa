"use client";

import { useId } from "react";
import { UiSelect, type UiSelectProps, type UiSelectOption } from "./ui-select";

// Re-export so form callers import the option type from the field they use.
export type { UiSelectOption };

export interface FormSelectProps
  extends Pick<
    UiSelectProps,
    | "name"
    | "value"
    | "defaultValue"
    | "onChange"
    | "options"
    | "placeholder"
    | "disabled"
    | "required"
    | "search"
    | "searchThreshold"
    | "searchPlaceholder"
    | "menuWidth"
  > {
  /** Visible field label (sans). Wired to the control via aria-labelledby so the
   *  custom combobox resolves an accessible name the same way a native
   *  `<label htmlFor>` would. */
  label: string;
  /** Optional helper text under the field (muted). Suppressed while an error shows. */
  description?: string;
  /** Error message — danger border on the trigger + a danger line announced via
   *  aria-describedby. */
  error?: string;
  /** Reserve the footer line height even when empty, so toggling an error/help
   *  line never shifts surrounding layout (§10.9). Off by default to keep dense
   *  create panels tight. */
  reserveFooter?: boolean;
  /** Wrapper class. */
  className?: string;
}

// `!` beats `.ui-input-compact`'s own `border-color` (utility-vs-class order is
// not guaranteed; important is). Token-anchored, mode-safe.
const DANGER_BORDER =
  "!border-[color:color-mix(in_oklab,var(--danger)_60%,var(--border-strong))]";

export function FormSelect({
  label,
  description,
  error,
  reserveFooter = false,
  className,
  required,
  ...selectProps
}: FormSelectProps) {
  const labelId = useId();
  const errorId = useId();
  const hasError = Boolean(error);
  const footer = hasError ? error : description;
  const showFooter = Boolean(footer) || reserveFooter;

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label
        id={labelId}
        className="text-[12.5px] font-medium leading-none text-[var(--text-secondary)]"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-[var(--danger-ink)]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {/* variant=compact (.ui-input-compact already sets font-sans) + portal so
          the menu escapes overflow-hidden form cards. Full width via w-full on
          the inline-block wrapper. */}
      <UiSelect
        {...selectProps}
        required={required}
        variant="compact"
        portal
        ariaLabelledBy={labelId}
        describedById={hasError ? errorId : undefined}
        className="w-full"
        buttonClassName={`w-full justify-between${hasError ? ` ${DANGER_BORDER}` : ""}`}
      />
      {showFooter ? (
        <p
          id={hasError ? errorId : undefined}
          className={`min-h-[1.25rem] text-[11.5px] leading-snug ${
            hasError ? "text-[var(--danger-ink)]" : "text-[var(--text-tertiary)]"
          }`}
        >
          {footer}
        </p>
      ) : null}
    </div>
  );
}
