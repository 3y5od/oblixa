export default function DecisionsSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading decisions. Queues and compare surfaces will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <header className="ui-page-header">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-28 rounded" />
            <div className="ui-skeleton h-9 w-56 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-xl rounded" />
          </div>
        </header>
        <div className="ui-skeleton h-40 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="ui-skeleton h-32 rounded-2xl" />
          <div className="ui-skeleton h-32 rounded-2xl" />
        </div>
      </div>
    </>
  );
}
