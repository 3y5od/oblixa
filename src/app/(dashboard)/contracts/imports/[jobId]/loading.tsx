export default function ImportJobLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading import job details.
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-4" aria-hidden aria-busy="true">
        <div className="ui-skeleton h-7 w-32 rounded-full" />
        <div className="space-y-2">
          <div className="ui-skeleton h-4 w-28 rounded" />
          <div className="ui-skeleton h-8 w-72 max-w-full rounded" />
          <div className="ui-skeleton h-4 w-56 max-w-full rounded" />
        </div>
        <div className="ui-card-raised rounded-2xl p-6">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="ui-skeleton h-3 w-16 rounded" />
                <div className="ui-skeleton h-7 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="ui-card-quiet rounded-2xl p-5">
          <div className="ui-skeleton h-4 w-40 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mt-3 ui-skeleton h-4 w-full rounded" />
          ))}
        </div>
      </div>
    </>
  );
}
