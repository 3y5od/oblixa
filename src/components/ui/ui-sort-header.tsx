import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface UiSortHeaderProps {
  label: ReactNode;
  href: string;
  direction?: SortDirection;
  className?: string;
}

/**
 * Sortable column header for table-style lists.
 * Renders the label + a chevron that indicates sort state (asc / desc / unsorted).
 * Wrap in a `<th>` or top-row cell. Uses Next.js <Link> for query-param updates.
 */
export function UiSortHeader({ label, href, direction = null, className }: UiSortHeaderProps) {
  const Icon = direction === "asc" ? ChevronUp : direction === "desc" ? ChevronDown : ChevronsUpDown;
  const ariaSort = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
  return (
    <Link
      href={href}
      aria-sort={ariaSort as React.AriaAttributes["aria-sort"]}
      className={`group inline-flex items-center gap-1 text-left transition-colors hover:text-[var(--text-primary)] ${className ?? ""}`}
    >
      <span>{label}</span>
      <Icon
        className={`h-3 w-3 shrink-0 transition-opacity ${direction ? "opacity-100" : "opacity-40 group-hover:opacity-80"}`}
        strokeWidth={1.85}
        aria-hidden
      />
    </Link>
  );
}
