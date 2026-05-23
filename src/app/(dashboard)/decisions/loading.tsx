export default function DecisionsSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading decisions. Queues and compare surfaces will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-28 rounded" />
              <div className="ui-skeleton h-8 w-56 rounded" />
              <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
            </div>
          </div>
        </div>
        <div className="ui-skeleton h-40 rounded-2xl" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="ui-skeleton h-32 rounded-2xl" />
          <div className="ui-skeleton h-32 rounded-2xl" />
        </div>
      </div>
    </>
  );
}
