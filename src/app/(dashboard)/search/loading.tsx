import { Search } from "lucide-react";

/** Loading skeleton mirrors the ready-state shape so initial paint doesn't
 *  shape-shift when the data resolves. Compact inline header + input + chip
 *  row + single outer band card with hairline-divided sections. */
export default function SearchLoading() {
  return (
    <div
      className="ui-page-stack mx-auto max-w-2xl gap-5"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading search"
    >
      <header className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)]"
        >
          <Search className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <h1 className="text-[1.625rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)]">
          Search
        </h1>
      </header>

      <span aria-hidden className="ui-skeleton block h-13 w-full rounded-2xl" />

      {/* Filter chip row — 4 chips, one per visible search group */}
      <div aria-hidden className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="ui-skeleton h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Single results card with band sections */}
      <div
        aria-hidden
        className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]"
      >
        {Array.from({ length: 3 }).map((_, bandIdx) => (
          <section key={bandIdx}>
            <header className="flex items-baseline justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-4 py-2">
              <span className="ui-skeleton h-3 w-20 rounded" />
              <span className="ui-skeleton h-3 w-4 rounded" />
            </header>
            <ul>
              {Array.from({ length: 3 }).map((__, rowIdx) => (
                <li
                  key={rowIdx}
                  className="flex min-h-[44px] items-center gap-3 px-4 py-2"
                >
                  <span className="ui-skeleton h-4 w-4 shrink-0 rounded" />
                  <span className="flex-1 space-y-1.5">
                    <span className="ui-skeleton block h-3.5 w-1/3 rounded" />
                    <span className="ui-skeleton block h-3 w-2/3 rounded" />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
