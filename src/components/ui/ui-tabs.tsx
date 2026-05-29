import Link from "next/link";
import type { ReactNode } from "react";

export interface UiTabItem {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
  icon?: ReactNode;
}

export interface UiTabsProps {
  items: ReadonlyArray<UiTabItem>;
  className?: string;
  ariaLabel?: string;
}

export function UiTabs({ items, className, ariaLabel = "Tabs" }: UiTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`flex flex-wrap items-end gap-1 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] ${className ?? ""}`}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium transition-colors ${
            item.active
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {item.icon ? (
            <span aria-hidden className="inline-flex shrink-0">
              {item.icon}
            </span>
          ) : null}
          <span>{item.label}</span>
          {typeof item.count === "number" ? (
            <span
              className={`ml-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-md border px-1 text-[11px] font-semibold leading-none tabular-nums ${
                item.count === 0
                  ? "border-transparent text-[var(--text-tertiary)] opacity-55"
                  : item.active
                    ? "border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]"
                    : "border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] text-[var(--text-secondary)]"
              }`}
            >
              {item.count}
            </span>
          ) : null}
          {item.active ? (
            <span
              aria-hidden
              className="absolute inset-x-2 bottom-[-1px] h-[2px] rounded-full bg-[var(--accent)]"
            />
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
