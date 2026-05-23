import type { ReactNode } from "react";

export interface UiFormHelpProps {
  id?: string;
  children: ReactNode;
}

export function UiFormHelp({ id, children }: UiFormHelpProps) {
  return (
    <p id={id} className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">
      {children}
    </p>
  );
}
