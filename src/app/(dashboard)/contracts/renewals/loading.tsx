export default function RenewalsLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading renewals.
      </div>
      <div className="ui-page-stack mx-auto w-full min-w-0 max-w-7xl" aria-hidden aria-busy="true">
        {/* Header: medallion + eyebrow/title/lead, with export + create actions. */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-8 w-8 rounded-md" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-7 w-44 rounded" />
              <div className="ui-skeleton h-3 w-96 max-w-full rounded" />
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <div className="ui-skeleton h-10 w-40 rounded-full" />
            <div className="ui-skeleton h-10 w-44 rounded-full" />
          </div>
        </div>

        <div className="ui-card overflow-hidden">
          {/* Summary band: eyebrow + count chips, then the definition strip. */}
          <div className="border-b border-[var(--border-subtle)] px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="ui-skeleton h-3 w-40 rounded" />
              <div className="ui-skeleton h-6 w-28 rounded-md" />
              <div className="ui-skeleton h-6 w-36 rounded-md" />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-3 w-52 max-w-full rounded" />
              ))}
            </div>
          </div>
          {/* Filter rail: window + four attribute filters + sort. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-10 w-32 rounded-full" />
            ))}
            <div className="ui-skeleton ml-auto h-10 w-28 rounded-full" />
          </div>
          {/* Active-filter scope line. */}
          <div className="border-b border-[var(--border-subtle)] px-5 py-2">
            <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
          </div>
          {/* Ledger rows: leading chevron + six columns. */}
          <div className="border-t border-[var(--border-subtle)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
                <div className="ui-skeleton mt-0.5 h-6 w-6 shrink-0 rounded-md" />
                <div className="grid flex-1 gap-x-4 gap-y-3 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="ui-skeleton h-5 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Ledger footer. */}
          <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-5 py-2.5">
            <div className="ui-skeleton h-3 w-28 rounded" />
            <div className="ui-skeleton h-3 w-32 rounded" />
            <div className="ui-skeleton ml-auto h-3 w-56 max-w-full rounded" />
          </div>
        </div>
      </div>
    </>
  );
}
