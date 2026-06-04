export default function ReportsSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading reports.
      </div>
      <div className="ui-page-stack mx-auto max-w-6xl" aria-hidden aria-busy="true">
        {/* Page identity */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-md" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-56 rounded" />
              <div className="ui-skeleton h-3 w-96 max-w-full rounded" />
            </div>
          </div>
          <div className="ui-skeleton h-9 w-48 rounded-full" />
        </div>

        {/* Master-detail shell: report rail beside the active report's header,
            filters, and preview — mirrors the loaded layout to avoid a jump. */}
        <div className="ui-card-raised p-0">
          <div className="border-b border-[var(--border-subtle)] px-5 py-3">
            <div className="ui-skeleton h-3 w-28 rounded" />
          </div>
          <div className="flex flex-col lg:flex-row">
            <div className="space-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] px-3 py-4 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="ui-skeleton h-7 rounded-lg" />
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-4 px-5 py-4">
              <div className="ui-skeleton h-6 w-48 rounded" />
              <div className="flex flex-wrap gap-2">
                <div className="ui-skeleton h-9 w-40 rounded-full" />
                <div className="ui-skeleton h-9 w-44 rounded-full" />
                <div className="ui-skeleton h-9 w-36 rounded-full" />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="ui-skeleton h-10 rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
