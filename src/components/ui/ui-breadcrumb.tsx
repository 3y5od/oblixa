import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface UiBreadcrumbItem {
  label: string;
  href?: string;
}

export interface UiBreadcrumbProps {
  items: ReadonlyArray<UiBreadcrumbItem>;
  className?: string;
}

export function UiBreadcrumb({ items, className }: UiBreadcrumbProps) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1 text-[11px] ${className ?? ""}`}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1">
            {idx > 0 ? (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]"
                strokeWidth={1.85}
                aria-hidden
              />
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-strong)]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={`font-medium ${
                  isLast ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
                }`}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
