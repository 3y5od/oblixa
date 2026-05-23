import type { ReactNode } from "react";

export interface UiButtonGroupProps {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
  attached?: boolean;
}

export function UiButtonGroup({ children, ariaLabel, className, attached = false }: UiButtonGroupProps) {
  if (attached) {
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={`inline-flex overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] [&>button]:rounded-none [&>button]:border-0 [&>button]:border-r [&>button]:border-r-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] [&>button:last-child]:border-r-0 [&>a]:rounded-none [&>a]:border-0 [&>a]:border-r [&>a]:border-r-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] [&>a:last-child]:border-r-0 ${className ?? ""}`}
      >
        {children}
      </div>
    );
  }
  return (
    <div role="group" aria-label={ariaLabel} className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {children}
    </div>
  );
}
