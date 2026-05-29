export default function RenewalsLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading renewals.
      </div>
      <div className="ui-page-stack mx-auto max-w-7xl" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-48 rounded" />
              <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <div className="ui-skeleton h-10 w-40 rounded-full" />
            <div className="ui-skeleton h-10 w-44 rounded-full" />
          </div>
        </div>

        <div className="ui-card-quiet overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <div className="ui-skeleton h-5 w-52 rounded" />
            <div className="ui-skeleton h-8 w-28 rounded-full" />
          </div>
          <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-5 py-3">
            <div className="ui-skeleton h-3 w-16 rounded" />
            <div className="ui-skeleton h-9 w-72 max-w-full rounded-[0.625rem]" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
            <div className="ui-skeleton h-3 w-10 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-9 w-32 rounded-lg" />
            ))}
            <div className="ui-skeleton h-9 w-16 rounded-lg" />
          </div>
          <div className="border-t border-[var(--border-subtle)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid gap-4 border-b border-[var(--border-subtle)] px-5 py-4 lg:grid-cols-7">
                {Array.from({ length: 7 }).map((__, j) => (
                  <div key={j} className="ui-skeleton h-5 rounded" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
