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

        <div className="ui-card-quiet overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-5 w-28 rounded-full" />
              <div className="ui-skeleton hidden h-1.5 w-24 rounded-full sm:block" />
            </div>
            <div className="flex items-center gap-x-5 sm:ml-auto">
              <div className="ui-skeleton h-4 w-20 rounded" />
              <div className="ui-skeleton h-4 w-24 rounded" />
            </div>
          </div>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.74fr)]">
            <div className="space-y-5 px-4 py-5 sm:px-5 lg:px-6">
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-7 w-56 rounded" />
                <div className="ui-skeleton h-4 w-44 rounded" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <div className="ui-skeleton h-3 w-28 rounded" />
                  <div className="ui-skeleton h-9 w-40 rounded" />
                  <div className="ui-skeleton h-5 w-48 rounded-full" />
                </div>
                <div className="space-y-2.5">
                  <div className="ui-skeleton h-3 w-36 rounded" />
                  <div className="ui-skeleton h-7 w-24 rounded" />
                  <div className="ui-skeleton h-3 w-28 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-28 rounded" />
                <div className="ui-skeleton h-12 w-full max-w-md rounded" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <div className="ui-skeleton h-10 w-28 rounded-full" />
                <div className="ui-skeleton h-10 w-20 rounded-full" />
                <div className="ui-skeleton h-10 w-32 rounded-full" />
                <div className="ui-skeleton h-10 w-20 rounded-full" />
              </div>
            </div>
            <div className="space-y-6 border-t border-[var(--border-subtle)] px-4 py-5 sm:px-5 lg:border-l lg:border-t-0 lg:px-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="ui-skeleton h-3 w-32 rounded" />
                  <div className="ui-skeleton h-4 w-28 rounded" />
                </div>
                <div className="ui-skeleton h-44 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-16 w-full rounded-md" />
                <div className="ui-skeleton h-8 w-32 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
