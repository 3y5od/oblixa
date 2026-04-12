export default function AssuranceSegmentLoading() {
  return (
    <>
      <span className="sr-only">Loading assurance</span>
      <div className="ui-page-stack" aria-hidden>
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-32 rounded" />
          <div className="ui-skeleton h-9 w-64 rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="ui-skeleton h-36 rounded-2xl" />
          <div className="ui-skeleton h-36 rounded-2xl" />
          <div className="ui-skeleton h-36 rounded-2xl" />
        </div>
        <div className="ui-skeleton h-48 rounded-2xl" />
      </div>
    </>
  );
}
