import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface UploadFieldProps {
  /** Input id — wired to the `<label htmlFor>` so label-driven test queries and
   *  screen readers resolve the control's accessible name. */
  id: string;
  label: string;
  /** Renders the accent "Required" chip inline with the label. */
  required?: boolean;
  /** Inline caps hint folded into the label (§7.4) — e.g. "Enter to add",
   *  "Read-only". Never a paragraph between label and control (§11.15). */
  hint?: string;
  /** Recoverable field error rendered in a reserved slot below the control. */
  error?: string;
  /** Leading glyph rendered inside the control gutter. The caller's input must
   *  carry `pl-9` so the value clears it. */
  icon?: LucideIcon;
  /** The control itself (input / UiSelect / tag editor). */
  children: ReactNode;
  className?: string;
}

/**
 * Label + optional leading icon + control + reserved error slot. The single
 * field wrapper for the contract upload editor so every row shares spacing,
 * the required-chip treatment, and the inline-hint pattern.
 */
export function UploadField({
  id,
  label,
  required,
  hint,
  error,
  icon: Icon,
  children,
  className,
}: UploadFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`min-w-0 ${className ?? ""}`.trim()}>
      <label
        htmlFor={id}
        className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]"
      >
        <span>{label}</span>
        {required ? (
          <span className="ui-caps-3 text-[9px] leading-none text-[var(--accent-strong)]">
            Required
          </span>
        ) : null}
        {hint ? (
          <span className="ui-caps-3 text-[9.5px] leading-none text-[var(--text-tertiary)]">
            {hint}
          </span>
        ) : null}
      </label>
      <div className="relative">
        {Icon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-tertiary)]"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
          </span>
        ) : null}
        {children}
      </div>
      {error ? (
        <p
          id={errorId}
          className="ui-caps-3 mt-1.5 text-[10px] leading-none text-[var(--danger-ink)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
