export default function ReviewQueueLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading review fields. Source evidence and field actions will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto w-full max-w-7xl" aria-hidden aria-busy="true">
        <div className="flex flex-col gap-2.5">
          <div className="ui-skeleton h-7 w-36 rounded-full" />
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-28 rounded" />
              <div className="ui-skeleton h-8 w-52 rounded" />
              <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
            </div>
          </div>
        </div>

        <div className="ui-card-raised overflow-hidden rounded-2xl">
          {/* Control bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_24%,transparent)] px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-5 w-28 rounded-full" />
              <div className="ui-skeleton hidden h-1.5 w-32 rounded-full sm:block" />
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className="ui-skeleton h-8 w-32 rounded-full" />
              <div className="ui-skeleton h-5 w-20 rounded-full" />
              <div className="ui-skeleton h-5 w-20 rounded-full" />
            </div>
          </div>

          {/* Body */}
          <div className="grid lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.74fr)]">
            <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-7 w-56 rounded" />
                <div className="ui-skeleton h-4 w-44 rounded" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="ui-skeleton h-3 w-28 rounded" />
                  <div className="ui-skeleton h-8 w-40 rounded" />
                  <div className="ui-skeleton h-5 w-48 rounded-full" />
                </div>
                <div className="space-y-3 sm:pl-6">
                  <div className="ui-skeleton h-3 w-36 rounded" />
                  <div className="ui-skeleton h-8 w-24 rounded" />
                  <div className="ui-skeleton h-3 w-28 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-28 rounded" />
                <div className="ui-skeleton h-14 w-full max-w-md rounded-lg" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <div className="ui-skeleton h-10 w-28 rounded-full" />
                <div className="ui-skeleton h-10 w-20 rounded-full" />
                <div className="ui-skeleton h-10 w-32 rounded-full" />
                <div className="ui-skeleton h-10 w-20 rounded-full" />
              </div>
            </div>
            <div className="space-y-6 border-t border-[var(--border-subtle)] px-5 py-5 sm:px-6 sm:py-6 lg:border-l lg:border-t-0">
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-32 rounded" />
                <div className="ui-skeleton h-5 w-40 rounded-md" />
                <div className="ui-skeleton h-44 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-16 w-full rounded-md" />
                <div className="ui-skeleton h-7 w-32 rounded-full" />
              </div>
            </div>
          </div>

          {/* Queue tray */}
          <div className="border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_24%,transparent)] px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-2">
              <div className="ui-skeleton h-3.5 w-3.5 rounded" />
              <div className="ui-skeleton h-3 w-36 rounded" />
              <div className="ui-skeleton h-4 w-7 rounded-md" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-9 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
