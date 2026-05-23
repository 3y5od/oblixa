import Link from "next/link";

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
  const first = 1;
  const last = totalPages;
  const showFirstLast = totalPages > 2;

  const linkClass =
    "ui-btn-secondary rounded-lg px-3 py-2 text-[12.5px]";
  const disabledClass =
    "rounded-lg border border-transparent px-3 py-2 text-[12.5px] text-[var(--text-tertiary)]";

  return (
    <div className="flex flex-col gap-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <p className="text-[12.5px] text-[var(--text-secondary)]">
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">
          {from}–{to}
        </span>
        <span className="text-[var(--text-tertiary)]"> · </span>
        <span className="tabular-nums">{total} total</span>
      </p>
      <nav
        className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
        aria-label="Pagination"
      >
        {showFirstLast &&
          (safePage > first ? (
            <Link href={buildHref(basePath, queryParams, first)} className={linkClass}>
              First
            </Link>
          ) : (
            <span className={disabledClass}>First</span>
          ))}
        {prev != null ? (
          <Link href={buildHref(basePath, queryParams, prev)} className={linkClass}>
            Previous
          </Link>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        <span className="rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_88%,white)] px-3 py-1 text-[12.5px] font-medium tabular-nums text-[var(--text-secondary)] shadow-[var(--shadow-1)]">
          {safePage} / {totalPages}
        </span>
        {next != null ? (
          <Link href={buildHref(basePath, queryParams, next)} className={linkClass}>
            Next
          </Link>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
        {showFirstLast &&
          (safePage < last ? (
            <Link href={buildHref(basePath, queryParams, last)} className={linkClass}>
              Last
            </Link>
          ) : (
            <span className={disabledClass}>Last</span>
          ))}
      </nav>
    </div>
  );
}
