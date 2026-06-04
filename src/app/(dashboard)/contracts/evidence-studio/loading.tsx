export default function EvidenceStudioLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading evidence.
      </div>
      <div className="ui-page-stack mx-auto max-w-7xl" aria-hidden aria-busy="true">
        {/* Page identity */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-md" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-64 rounded" />
              <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
            </div>
          </div>
          <div className="ui-skeleton h-10 w-40 rounded-full" />
        </div>

        {/* Request queue shell */}
        <div className="ui-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3">
            <div className="ui-skeleton h-4 w-44 rounded" />
            <div className="ui-skeleton h-7 w-28 rounded-full" />
          </div>
          {/* Tabs */}
          <div className="flex gap-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ui-skeleton h-4 w-24 rounded" />
            ))}
          </div>
          {/* Filter row */}
          <div className="grid gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="ui-skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
          {/* Skeleton rows matching the real table's column rhythm */}
          <div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto] items-center gap-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] px-5 py-4"
              >
                <div className="space-y-1.5">
                  <div className="ui-skeleton h-4 w-3/4 rounded" />
                  <div className="ui-skeleton h-3 w-1/2 rounded" />
                </div>
                <div className="ui-skeleton h-4 w-24 rounded" />
                <div className="ui-skeleton h-4 w-20 rounded" />
                <div className="ui-skeleton h-5 w-20 rounded-full" />
                <div className="ui-skeleton h-8 w-24 justify-self-end rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
