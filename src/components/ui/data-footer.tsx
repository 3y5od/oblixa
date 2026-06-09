import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { TimeChip } from "@/components/ui/time-chip";

/**
 * Shared footer for the dense data surfaces. Three-zone grid: a "shown / total"
 * count chip + section label (with an optional `.ui-dot-sep` "filtered" flag) on
 * the left, pagination in the center, and a "last update" time chip on the
 * right. `variant="sticky"` pins it to the bottom of a bounded-scroll region
 * (Renewals) with the count only. Generalized from the Evidence footer so Work,
 * Evidence, and Renewals stop hand-building three different footers.
 *
 * `pagination.showFirstLast` adds First/Last jumps flanking prev/next, so this
 * one footer also covers the richer contracts pagination (which spans many
 * pages) and the contracts list stops hand-building its own.
 */

function PageLink({
  href,
  disabled,
  direction,
}: {
  href: string;
  disabled: boolean;
  direction: "first" | "prev" | "next" | "last";
}) {
  const Icon =
    direction === "first"
      ? ChevronsLeft
      : direction === "prev"
        ? ChevronLeft
        : direction === "next"
          ? ChevronRight
          : ChevronsRight;
  const label =
    direction === "first"
      ? "First page"
      : direction === "prev"
        ? "Previous page"
        : direction === "next"
          ? "Next page"
          : "Last page";
  if (disabled) {
    return (
      <span
        aria-disabled
        className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full border border-[var(--border-subtle)] text-[color:color-mix(in_oklab,var(--text-tertiary)_55%,transparent)]"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="ui-btn-ghost inline-flex h-7 w-7 items-center justify-center rounded-full p-0"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}

export interface DataFooterProps {
  shown: number;
  total: number;
  /** Caps label on the count chip; defaults to "Shown". */
  countLabel?: string;
  /** Caps section qualifier rendered after the count chip (e.g. "open requests"). */
  sectionLabel?: string;
  filtered?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    hrefFor: (page: number) => string;
    /** Add First/Last jumps flanking prev/next (for surfaces that span many pages). */
    showFirstLast?: boolean;
  };
  lastUpdate?: Date | string | null;
  variant?: "default" | "sticky";
  className?: string;
}

export function DataFooter({
  shown,
  total,
  countLabel = "Shown",
  sectionLabel,
  filtered,
  pagination,
  lastUpdate,
  variant = "default",
  className,
}: DataFooterProps) {
  const base =
    "grid min-w-0 grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3 text-[11.5px] text-[var(--text-tertiary)] sm:grid-cols-[1fr_auto_1fr]";
  const surface =
    variant === "sticky"
      ? "sticky bottom-0 z-10 bg-[color:color-mix(in_oklab,var(--surface-muted)_94%,var(--surface-raised))]"
      : "bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)]";
  return (
    <div
      className={`${base} ${surface} ${className ?? ""}`.trim()}
      style={
        variant === "sticky"
          ? { boxShadow: "0 -10px 20px -16px color-mix(in oklab, var(--text-primary) 18%, transparent)" }
          : undefined
      }
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <KeyValueChip label={countLabel} value={`${shown} / ${total}`} />
        {sectionLabel ? <span className="ui-caps-3 text-[var(--text-tertiary)]">{sectionLabel}</span> : null}
        {filtered ? (
          <span className="inline-flex items-center">
            <span className="ui-dot-sep" aria-hidden>
              ·
            </span>
            <span className="ui-caps-3 text-[var(--text-secondary)]">filtered</span>
          </span>
        ) : null}
      </div>
      <div className="flex justify-start sm:justify-center">
        {pagination && pagination.totalPages > 1 ? (
          <nav aria-label="Pagination" className="flex items-center gap-2">
            {pagination.showFirstLast ? (
              <PageLink
                href={pagination.hrefFor(1)}
                disabled={pagination.page <= 1}
                direction="first"
              />
            ) : null}
            <PageLink
              href={pagination.hrefFor(pagination.page - 1)}
              disabled={pagination.page <= 1}
              direction="prev"
            />
            <span className="ui-caps-3 tabular-nums text-[var(--text-secondary)]">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <PageLink
              href={pagination.hrefFor(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              direction="next"
            />
            {pagination.showFirstLast ? (
              <PageLink
                href={pagination.hrefFor(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                direction="last"
              />
            ) : null}
          </nav>
        ) : null}
      </div>
      <div className="flex justify-start sm:justify-end">
        {lastUpdate ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="ui-caps-3 text-[var(--text-tertiary)]">Last update</span>
            <TimeChip date={lastUpdate} bordered />
          </span>
        ) : null}
      </div>
    </div>
  );
}
