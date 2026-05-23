export default function ContractsLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading contracts. Filters and table rows will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="ui-page-header flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-48 rounded" />
              <div className="flex flex-wrap gap-1.5">
                <div className="ui-skeleton h-7 w-24 rounded-full" />
                <div className="ui-skeleton h-7 w-24 rounded-full" />
                <div className="ui-skeleton h-7 w-24 rounded-full" />
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="ui-skeleton h-9 w-32 rounded-xl" />
            <div className="ui-skeleton h-9 w-24 rounded-xl" />
            <div className="ui-skeleton h-9 w-20 rounded-xl" />
          </div>
        </div>

        {/* Compact toolbar — single slim row */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] px-2.5 py-2">
          <div className="ui-skeleton h-9 flex-1 min-w-[10rem] rounded-md" />
          <div className="ui-skeleton h-9 w-40 rounded-md" />
          <div className="ui-skeleton h-9 w-40 rounded-md" />
          <div className="ui-skeleton h-9 w-16 rounded-md" />
          <div className="ui-skeleton h-9 w-24 rounded-md" />
          <div className="ui-skeleton h-9 w-32 rounded-md" />
        </div>

        {/* Quick-filter chip strip */}
        <div className="flex flex-wrap gap-1.5 px-1">
          <div className="ui-skeleton h-8 w-28 rounded-full" />
          <div className="ui-skeleton h-8 w-32 rounded-full" />
          <div className="ui-skeleton h-8 w-28 rounded-full" />
          <div className="ui-skeleton h-8 w-32 rounded-full" />
        </div>

        {/* Table */}
        <div className="ui-skeleton h-96 rounded-2xl" />
      </div>
    </>
  );
}
