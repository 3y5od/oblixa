import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function buildHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number
): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) search.set(k, v);
  }
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

interface ContractPaginationProps {
  total: number;
  page: number;
  pageSize: number;
  /** Path without query, e.g. `/contracts` or `/contracts/review` */
  basePath: string;
  /** Current filter params to preserve (omit `page`; it is set from `page` arg). */
  queryParams: Record<string, string | undefined>;
}

// Unified control silhouette for First / Previous / Next / Last so the bar
// reads as one normalized set instead of four ad-hoc links. Enabled controls
// pick up the accent affordance on hover/focus; disabled controls drop their
// border + mute to text-tertiary so "unavailable" is visible, not invisible.
const CONTROL_BASE =
  "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold leading-none tabular-nums transition-colors";
const CONTROL_ENABLED =
  "border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-strong))] hover:bg-[color:color-mix(in_oklab,var(--accent)_6%,transparent)] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
// Disabled controls stay legible: a faint border + tertiary ink reads as
// "present but off". The old opacity-70 washed the label out instead of just
// signalling unavailability.
const CONTROL_DISABLED =
  "border border-[color:color-mix(in_oklab,var(--border-subtle)_45%,transparent)] text-[var(--text-tertiary)] cursor-not-allowed";

function PageControl({
  href,
  label,
  icon: Icon,
  iconSide,
}: {
  href: string | null;
  label: string;
  icon: LucideIcon;
  iconSide: "left" | "right";
}) {
  const glyph = (
    <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
  );
  const body = (
    <>
      {iconSide === "left" ? glyph : null}
      {label}
      {iconSide === "right" ? glyph : null}
    </>
  );
  if (href == null) {
    return (
      <span className={`${CONTROL_BASE} ${CONTROL_DISABLED}`} aria-disabled>
        {body}
      </span>
    );
  }
  return (
    <Link href={href} className={`${CONTROL_BASE} ${CONTROL_ENABLED}`}>
      {body}
    </Link>
  );
}

export function ContractPagination({
  total,
  page,
  pageSize,
  basePath,
  queryParams,
}: ContractPaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const prev = safePage > 1 ? safePage - 1 : null;
  const next = safePage < totalPages ? safePage + 1 : null;
  const showFirstLast = totalPages > 2;

  return (
    <div className="flex flex-col gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_36%,transparent)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      {/* Structured count chips — a range pill + a total pill that echo the
          h-7 rounded-md / border-subtle silhouette of the nav controls, so the
          whole bar reads as one normalized set. Range uses an en dash; all
          figures tabular. */}
      <dl className="flex items-center gap-2 text-[12px] leading-none">
        <dt className="sr-only">Showing contracts</dt>
        <dd className="inline-flex h-7 items-center rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[var(--surface-raised)] px-2.5 font-semibold tabular-nums text-[var(--text-primary)]">
          {from}–{to}
        </dd>
        <dt className="sr-only">Total contracts</dt>
        <dd className="inline-flex h-7 items-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,transparent)] px-2.5">
          <span className="font-semibold tabular-nums text-[var(--text-secondary)]">{total}</span>
          <span className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">total</span>
        </dd>
      </dl>
      <nav
        className="flex flex-wrap items-center justify-center gap-2"
        aria-label="Pagination"
      >
        {showFirstLast ? (
          <PageControl
            href={safePage > 1 ? buildHref(basePath, queryParams, 1) : null}
            label="First"
            icon={ChevronsLeft}
            iconSide="left"
          />
        ) : null}
        <PageControl
          href={prev != null ? buildHref(basePath, queryParams, prev) : null}
          label="Previous"
          icon={ChevronLeft}
          iconSide="left"
        />
        <span className="inline-flex h-8 items-center rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))] px-3 text-[12px] font-semibold tabular-nums text-[var(--text-primary)] shadow-[var(--shadow-1)]">
          {safePage} / {totalPages}
        </span>
        <PageControl
          href={next != null ? buildHref(basePath, queryParams, next) : null}
          label="Next"
          icon={ChevronRight}
          iconSide="right"
        />
        {showFirstLast ? (
          <PageControl
            href={
              safePage < totalPages
                ? buildHref(basePath, queryParams, totalPages)
                : null
            }
            label="Last"
            icon={ChevronsRight}
            iconSide="right"
          />
        ) : null}
      </nav>
    </div>
  );
}
