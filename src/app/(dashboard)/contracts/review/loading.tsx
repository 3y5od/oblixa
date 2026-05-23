export default function ReviewQueueLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading review fields. Source evidence and field actions will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto max-w-7xl" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-28 rounded" />
              <div className="ui-skeleton h-8 w-52 rounded" />
              <div className="ui-skeleton h-3 w-96 max-w-full rounded" />
            </div>
          </div>
        </div>

        <div className="ui-card-raised overflow-hidden rounded-2xl border">
          <div className="grid gap-0 border-b border-[var(--border-subtle)] md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="border-b border-[var(--border-subtle)] px-4 py-4 md:border-b-0 md:border-r sm:px-5">
                <div className="ui-skeleton h-3 w-28 rounded" />
                <div className="ui-skeleton mt-3 h-7 w-20 rounded" />
                <div className="ui-skeleton mt-2 h-3 w-32 rounded" />
              </div>
            ))}
          </div>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.74fr)]">
            <div className="space-y-5 px-4 py-5 sm:px-5 lg:px-6">
              <div className="ui-skeleton h-7 w-56 rounded" />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="ui-skeleton h-24 rounded-xl" />
                ))}
              </div>
              <div className="ui-skeleton h-10 w-96 max-w-full rounded-xl" />
            </div>
            <div className="border-t border-[var(--border-subtle)] px-4 py-5 sm:px-5 lg:border-l lg:border-t-0 lg:px-6">
              <div className="ui-skeleton h-28 rounded-xl" />
              <div className="ui-skeleton mt-5 h-44 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
