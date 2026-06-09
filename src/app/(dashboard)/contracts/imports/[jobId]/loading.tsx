export default function ImportJobLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading import job details.
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4" aria-hidden aria-busy="true">
        <div className="ui-skeleton h-7 w-32 rounded-full" />
        <div className="flex items-start gap-3.5">
          <div className="ui-skeleton h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="ui-skeleton h-3 w-28 rounded" />
            <div className="ui-skeleton h-8 w-72 max-w-full rounded" />
            <div className="ui-skeleton h-4 w-56 max-w-full rounded" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="ui-card-raised rounded-2xl p-6 lg:col-span-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 border-t border-[var(--border-subtle)] py-3 first:border-t-0 first:pt-0 last:pb-0"
              >
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-7 w-12 rounded" />
              </div>
            ))}
          </div>
          <div className="ui-card-quiet rounded-2xl p-5 lg:col-span-2">
            <div className="ui-skeleton h-4 w-44 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mt-3 ui-skeleton h-4 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
