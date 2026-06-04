import Link from "next/link";
import type { ReactNode } from "react";
import type { StatTone } from "@/components/ui/stat-cell";

export interface UiTabItem {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
  /** Optional semantic tone for the count pill. Pass `success` for a zero on a
   *  "needs action" tab (e.g. Overdue → 0) so it reads as all-clear rather than
   *  a ghosted grey afterthought (§10.10). Omit for ordinary neutral counts. */
  countTone?: StatTone;
  icon?: ReactNode;
}

// Shared geometry for the count pill so every tab count reads as one primitive
// regardless of state — the tone branches only swap color, never the shape.
const COUNT_PILL_BASE =
  "ml-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-md border px-1.5 text-[10.5px] font-semibold leading-none tabular-nums";

function countPillClass(item: UiTabItem): string {
  // All-clear: a 0 on a needs-action tab is the desired outcome, not "no data".
  // Muted success (§10.10), matching the page's overview chips.
  if (item.countTone === "success") {
    return `${COUNT_PILL_BASE} border-[color:color-mix(in_oklab,var(--success-ink)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_30%,var(--surface-raised))] text-[var(--success-ink)]`;
  }
  // Untoned zero: quiet but still a real bordered pill — never a faint,
  // borderless number that reads as a stray afterthought.
  if (item.count === 0) {
    return `${COUNT_PILL_BASE} border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] text-[var(--text-tertiary)]`;
  }
  if (item.active) {
    return `${COUNT_PILL_BASE} border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]`;
  }
  return `${COUNT_PILL_BASE} border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] text-[var(--text-secondary)]`;
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
      className={`flex max-w-full items-end gap-1 overflow-x-auto border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] [contain:inline-size] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          // Underline tab: the active state is carried by weight (semibold) + a
          // clean accent underbar, not a filled/bordered box — a folder fill
          // reads heavy sitting directly above the dense filter row. Neither
          // state has a border, so the active tab never shifts row height (§10.9).
          className={`relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] ${
            item.active
              ? "font-semibold text-[var(--accent-strong)]"
              : "font-medium text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_55%,transparent)] hover:text-[var(--text-primary)]"
          }`}
        >
          {item.icon ? (
            <span aria-hidden className="inline-flex shrink-0">
              {item.icon}
            </span>
          ) : null}
          <span>{item.label}</span>
          {typeof item.count === "number" ? (
            <span className={countPillClass(item)}>{item.count}</span>
          ) : null}
          {item.active ? (
            <span
              aria-hidden
              className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-[var(--accent)]"
            />
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
