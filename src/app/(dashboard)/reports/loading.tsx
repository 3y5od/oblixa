export default function ReportsSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading reports. Operational summaries and export status will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-40 rounded" />
          <div className="ui-skeleton h-10 w-72 rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="ui-skeleton h-40 rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="ui-skeleton h-36 rounded-2xl" />
          <div className="ui-skeleton h-36 rounded-2xl" />
          <div className="ui-skeleton h-36 rounded-2xl" />
        </div>
      </div>
    </>
  );
}
