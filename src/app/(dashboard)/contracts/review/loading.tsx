export default function ReviewQueueLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading details to confirm. Source evidence and detail actions will appear shortly.
      </div>
      <div className="ui-page-stack-dense mx-auto w-full max-w-7xl" aria-hidden aria-busy="true">
        <div className="flex flex-col gap-2">
          <div className="ui-skeleton h-4 w-32 rounded" />
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-52 rounded" />
              <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
            </div>
            <div className="ui-skeleton hidden h-12 w-60 rounded-xl sm:block" />
          </div>
        </div>

        <div className="ui-card overflow-hidden rounded-2xl lg:flex lg:h-[calc(100vh-13rem)] lg:min-h-[32rem] lg:flex-col">
          {/* Control bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_24%,transparent)] px-5 py-3 sm:px-6 lg:shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-5 w-36 rounded" />
              <div className="ui-skeleton h-5 w-24 rounded-full" />
              <div className="ui-skeleton hidden h-1.5 w-32 rounded-full sm:block" />
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className="ui-skeleton h-4 w-24 rounded" />
              <div className="ui-skeleton h-8 w-40 rounded-full" />
            </div>
          </div>

          {/* Three-pane body — queue rail (col 1) | decision (col 2) | evidence (col 3) */}
          <div className="grid md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[20rem_minmax(0,1fr)_22rem]">
            {/* Decision */}
            <div className="flex flex-col px-5 py-5 sm:px-6 sm:py-6 md:col-start-1 md:row-start-1 lg:col-start-2 lg:min-h-0 lg:overflow-y-auto lg:pb-0">
              <div className="flex-1 space-y-5">
                <div className="space-y-2">
                  <div className="ui-skeleton h-3 w-16 rounded" />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="ui-skeleton h-7 w-48 rounded" />
                    <div className="ui-skeleton h-5 w-14 rounded-full" />
                    <div className="ui-skeleton h-5 w-24 rounded-full" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="ui-skeleton h-3 w-28 rounded" />
                  <div className="ui-skeleton h-[4.5rem] w-full rounded-xl" />
                  <div className="ui-skeleton h-4 w-56 max-w-full rounded" />
                </div>
              </div>
              {/* Sticky action bar */}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
                <div className="ui-skeleton h-10 w-28 rounded-full" />
                <div className="ui-skeleton h-10 w-20 rounded-full" />
                <div className="ui-skeleton h-10 w-32 rounded-full" />
                <div className="ui-skeleton h-10 w-20 rounded-full" />
              </div>
            </div>

            {/* Evidence */}
            <div className="space-y-6 border-t border-[var(--border-subtle)] px-5 py-5 sm:px-6 sm:py-6 md:col-start-2 md:row-start-1 md:border-l md:border-t-0 lg:col-start-3 lg:min-h-0 lg:overflow-y-auto">
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-16 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                {/* File switcher tab strip */}
                <div className="flex gap-1.5">
                  <div className="ui-skeleton h-6 w-24 rounded-md" />
                  <div className="ui-skeleton h-6 w-20 rounded-md" />
                </div>
                <div className="ui-skeleton h-56 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-16 w-full rounded-md" />
                <div className="ui-skeleton h-9 w-full rounded-lg" />
              </div>
            </div>

            {/* Queue rail */}
            <div className="border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_24%,transparent)] px-5 py-4 sm:px-6 sm:py-5 md:col-span-2 md:row-start-2 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-t-0 lg:py-5">
              <div className="flex items-center gap-2">
                <div className="ui-skeleton h-3.5 w-3.5 rounded" />
                <div className="ui-skeleton h-3 w-36 rounded" />
                <div className="ui-skeleton h-4 w-7 rounded-md" />
              </div>
              {/* Search + filter chips */}
              <div className="ui-skeleton mt-3 h-8 w-full rounded-full" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="ui-skeleton h-6 w-16 rounded-full" />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="ui-skeleton h-14 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
