import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface UploadFieldProps {
  /** Input id — wired to the `<label htmlFor>` so label-driven test queries and
   *  screen readers resolve the control's accessible name. */
  id: string;
  label: string;
  /** Renders a quiet sentence-case "Required" marker inline with the label. */
  required?: boolean;
  /** Inline sentence-case hint folded into the label — e.g. "Enter to add",
   *  "Read-only". Never a paragraph between label and control (§17). */
  hint?: string;
  /** Sentence-level helper rendered quietly *below* the control (§11.15 keeps
   *  paragraphs out of the label→control gap). Use for constraint, consequence,
   *  or recovery copy — e.g. what a value drives once confirmed. */
  help?: ReactNode;
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
  help,
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
          <span className="text-[11px] font-normal leading-none text-[var(--text-tertiary)]">
            Required
          </span>
        ) : null}
        {hint ? (
          <span className="text-[11px] font-normal leading-none text-[var(--text-tertiary)]">
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
      {help && !error ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
          {help}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="mt-1.5 text-[11.5px] leading-snug text-[var(--danger-ink)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
