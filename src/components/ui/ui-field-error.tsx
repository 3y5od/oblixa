import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export interface UiFieldErrorProps {
  id?: string;
  children: ReactNode;
}

export function UiFieldError({ id, children }: UiFieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 inline-flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--danger-ink)]"
    >
      <AlertCircle className="mt-[1.5px] h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
