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

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200/90 bg-zinc-50/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500">
        Showing{" "}
        <span className="font-semibold text-zinc-900">
          {from}–{to}
        </span>{" "}
        of <span className="font-semibold text-zinc-900">{total}</span>
      </p>
      <nav className="flex items-center gap-2" aria-label="Pagination">
        {prev != null ? (
          <Link
            href={buildHref(basePath, queryParams, prev)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-zinc-400">
            Previous
          </span>
        )}
        <span className="px-1 text-sm tabular-nums text-zinc-500">
          Page {safePage} of {totalPages}
        </span>
        {next != null ? (
          <Link
            href={buildHref(basePath, queryParams, next)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-zinc-400">
            Next
          </span>
        )}
      </nav>
    </div>
  );
}
