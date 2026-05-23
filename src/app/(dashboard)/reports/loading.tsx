export default function ReportsSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading reports.
      </div>
      <div className="ui-page-stack mx-auto max-w-5xl" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-32 rounded" />
              <div className="ui-skeleton h-8 w-72 rounded" />
              <div className="ui-skeleton h-3 w-96 max-w-full rounded" />
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="ui-skeleton h-24 rounded-2xl" />
          <div className="ui-skeleton h-24 rounded-2xl" />
          <div className="ui-skeleton h-24 rounded-2xl" />
        </div>
        <div className="ui-skeleton h-48 rounded-2xl" />
      </div>
    </>
  );
}
