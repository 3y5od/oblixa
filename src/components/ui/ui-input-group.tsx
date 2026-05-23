import type { ReactNode } from "react";

export interface UiInputGroupProps {
  prefix?: ReactNode;
  suffix?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function UiInputGroup({ prefix, suffix, children, className }: UiInputGroupProps) {
  return (
    <div
      className={`inline-flex min-h-11 w-full items-stretch overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-none focus-within:border-[color:color-mix(in_oklab,var(--accent)_42%,var(--border-strong))] focus-within:ring-2 focus-within:ring-[color:color-mix(in_oklab,var(--accent)_22%,transparent)] ${className ?? ""}`}
    >
      {prefix ? (
        <span className="inline-flex items-center px-3 text-[12.5px] font-medium text-[var(--text-tertiary)]">
          {prefix}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
      {suffix ? (
        <span className="inline-flex items-center px-3 text-[12.5px] font-medium text-[var(--text-tertiary)]">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
