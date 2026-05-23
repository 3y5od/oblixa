import { useId, type ReactNode } from "react";
import { UiFieldError } from "@/components/ui/ui-field-error";
import { UiFormHelp } from "@/components/ui/ui-form-help";

export interface UiFieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function UiField({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
  className,
}: UiFieldProps) {
  const generatedId = useId();
  const fieldId = htmlFor ?? generatedId;
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <label
        htmlFor={fieldId}
        className={`block text-[12.5px] font-medium text-[var(--text-primary)] ${required ? "ui-label-required" : ""}`}
      >
        {label}
      </label>
      {children}
      {help ? <UiFormHelp id={helpId}>{help}</UiFormHelp> : null}
      {error ? <UiFieldError id={errorId}>{error}</UiFieldError> : null}
    </div>
  );
}
