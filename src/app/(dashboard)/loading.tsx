export default function DashboardSegmentLoading() {
  return (
    <>
      <span className="sr-only">Loading workspace</span>
      <div className="ui-page-stack" aria-hidden>
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-28 rounded" />
          <div className="ui-skeleton h-9 w-56 rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="ui-skeleton h-48 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="ui-skeleton h-36 rounded-2xl" />
          <div className="ui-skeleton h-36 rounded-2xl" />
          <div className="ui-skeleton h-36 rounded-2xl md:max-xl:col-span-2 xl:col-span-1" />
        </div>
      </div>
    </>
  );
}
