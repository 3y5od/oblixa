export default function RenewalsWorkspaceLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading renewals workspace. Horizon filters and renewal rows will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-32 rounded" />
            <div className="ui-skeleton h-9 w-72 max-w-full rounded" />
            <div className="ui-skeleton h-4 w-[36rem] max-w-full rounded" />
            <div className="flex flex-wrap gap-2">
              <div className="ui-skeleton h-7 w-36 rounded-full" />
              <div className="ui-skeleton h-7 w-28 rounded-full" />
              <div className="ui-skeleton h-7 w-28 rounded-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="ui-skeleton h-10 w-32 rounded-full" />
            <div className="ui-skeleton h-10 w-40 rounded-full" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ui-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="ui-skeleton h-10 w-10 rounded-2xl" />
                <div className="ui-skeleton h-6 w-20 rounded-full" />
              </div>
              <div className="ui-skeleton mt-4 h-7 w-24 rounded" />
              <div className="ui-skeleton mt-3 h-4 w-full rounded" />
              <div className="mt-4 flex gap-2">
                <div className="ui-skeleton h-7 w-20 rounded-full" />
                <div className="ui-skeleton h-7 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="ui-page-shell">
            <div className="ui-skeleton h-4 w-36 rounded" />
            <div className="ui-skeleton mt-3 h-6 w-72 max-w-full rounded" />
            <div className="ui-skeleton mt-3 h-4 w-full max-w-2xl rounded" />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-8 rounded-full" />
              ))}
            </div>
          </div>
          <div className="ui-card p-5">
            <div className="ui-skeleton h-4 w-28 rounded" />
            <div className="ui-skeleton mt-3 h-6 w-48 rounded" />
            <div className="ui-skeleton mt-4 h-10 w-full rounded" />
            <div className="ui-skeleton mt-3 h-16 w-full rounded" />
          </div>
        </div>

        <div className="ui-page-shell">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <div className="ui-skeleton h-5 w-40 rounded" />
              <div className="ui-skeleton mt-4 h-10 w-full max-w-sm rounded" />
              <div className="mt-4 flex gap-2">
                <div className="ui-skeleton h-7 w-28 rounded-full" />
                <div className="ui-skeleton h-7 w-20 rounded-full" />
              </div>
            </div>
            <div className="border-t border-[var(--border-subtle)] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="ui-skeleton h-5 w-44 rounded" />
              <div className="ui-skeleton mt-4 h-10 w-full max-w-sm rounded" />
              <div className="mt-4 grid gap-2">
                <div className="ui-skeleton h-16 rounded-2xl" />
                <div className="ui-skeleton h-16 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>

        <div className="ui-page-shell">
          <div className="ui-skeleton h-5 w-36 rounded" />
          <div className="ui-skeleton mt-3 h-4 w-full max-w-2xl rounded" />
          <div className="mt-5 grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ui-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="ui-skeleton h-5 w-56 rounded" />
                    <div className="ui-skeleton mt-3 h-4 w-72 max-w-full rounded" />
                  </div>
                  <div className="ui-skeleton h-7 w-24 rounded-full" />
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <div className="ui-skeleton h-40 rounded-2xl" />
                  <div className="ui-skeleton h-40 rounded-2xl" />
                  <div className="ui-skeleton h-40 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
