export default function DecisionsSegmentLoading() {
  return (
    <>
      <span className="sr-only">Loading decisions</span>
      <div className="ui-page-stack" aria-hidden>
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-28 rounded" />
          <div className="ui-skeleton h-9 w-56 rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="ui-skeleton h-40 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="ui-skeleton h-32 rounded-2xl" />
          <div className="ui-skeleton h-32 rounded-2xl" />
        </div>
      </div>
    </>
  );
}
