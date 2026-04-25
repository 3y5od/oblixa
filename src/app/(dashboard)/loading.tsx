export default function DashboardSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading workspace. Dashboard cards and queue summaries will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-28 rounded" />
          <div className="ui-skeleton h-9 w-56 rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="ui-page-shell p-4">
          <div className="ui-skeleton h-48 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="ui-page-shell p-4">
            <div className="ui-skeleton h-36 rounded-2xl" />
          </div>
          <div className="ui-page-shell p-4">
            <div className="ui-skeleton h-36 rounded-2xl" />
          </div>
          <div className="ui-page-shell p-4 md:max-xl:col-span-2 xl:col-span-1">
            <div className="ui-skeleton h-36 rounded-2xl" />
          </div>
        </div>
      </div>
    </>
  );
}
