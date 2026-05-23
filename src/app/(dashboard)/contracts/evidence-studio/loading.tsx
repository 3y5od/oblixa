export default function EvidenceStudioLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading evidence.
      </div>
      <div className="ui-page-stack mx-auto max-w-6xl" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-72 rounded" />
              <div className="ui-skeleton h-3 w-96 max-w-full rounded" />
            </div>
          </div>
        </div>
        <div className="ui-skeleton h-72 rounded-2xl" />
      </div>
    </>
  );
}
