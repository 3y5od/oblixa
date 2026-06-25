import { LoadingCard } from "@/components/ui/segment-loading";

// Skeleton mirrors the live geometry — compact header, ledger summary band,
// condition chips, view tabs, filter row, the "showing N tasks" summary, and the
// task ledger — so nothing shifts when data resolves (§34, quality floor: no
// load-time layout shift).
export default function WorkLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading tasks.
      </div>
      <div
        className="ui-page-stack mx-auto w-full min-w-0 max-w-[1440px] overflow-x-clip"
        aria-hidden
        aria-busy="true"
      >
        <header className="ui-page-header flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-8 w-8 rounded-md" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-32 rounded" />
              <div className="ui-skeleton h-7 w-24 rounded" />
              <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
            </div>
          </div>
          <div className="ui-skeleton h-9 w-28 rounded-md" />
        </header>

        <LoadingCard className="ui-table-shell">
          {/* Summary band: count + condition chips + definition line */}
          <div className="space-y-2.5 border-b border-[var(--border-subtle)] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="ui-skeleton h-3.5 w-24 rounded" />
              <div className="ui-skeleton h-4 w-20 rounded" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-6 w-36 rounded-md" />
              ))}
            </div>
            <div className="ui-skeleton h-3 w-full max-w-[52rem] rounded" />
          </div>
          {/* View tabs */}
          <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-7 w-24 rounded-md" />
            ))}
          </div>
          {/* Filter row */}
          <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] px-5 py-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-10 w-32 rounded-full" />
            ))}
          </div>
          {/* "Showing N tasks across M contracts" summary */}
          <div className="border-b border-[var(--border-subtle)] px-5 py-2">
            <div className="ui-skeleton h-3 w-56 rounded" />
          </div>
          {/* Ledger header + rows */}
          <div className="flex items-center gap-6 bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))] px-5 py-3">
            <div className="ui-skeleton h-3 w-40 rounded" />
            <div className="ml-auto hidden gap-6 md:flex">
              <div className="ui-skeleton h-3 w-16 rounded" />
              <div className="ui-skeleton h-3 w-16 rounded" />
              <div className="ui-skeleton h-3 w-16 rounded" />
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 border-t border-[var(--border-subtle)] px-5 py-3"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="ui-skeleton h-8 w-8 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="ui-skeleton h-2.5 w-16 rounded" />
                  <div className="ui-skeleton h-4 w-64 max-w-full rounded" />
                  <div className="ui-skeleton h-3 w-48 max-w-full rounded" />
                </div>
              </div>
              <div className="hidden gap-6 md:flex">
                <div className="ui-skeleton h-8 w-16 rounded" />
                <div className="ui-skeleton h-6 w-24 rounded-full" />
              </div>
              <div className="ui-skeleton h-8 w-36 rounded-full" />
            </div>
          ))}
        </LoadingCard>
      </div>
    </>
  );
}
