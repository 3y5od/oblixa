export default function ReviewQueueLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading details to confirm. Source evidence and detail actions will appear shortly.
      </div>
      <div
        className="ui-page-stack-dense w-full xl:flex xl:h-[calc(100dvh-156px)] xl:flex-col xl:overflow-hidden"
        aria-hidden
        aria-busy="true"
      >
        {/* Route header — breadcrumb, title, lead, and the workspace-scope meta
            line (left-aligned, integrated with the identity block). */}
        <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] pb-4 xl:shrink-0">
          <div className="ui-skeleton h-3.5 w-40 rounded" />
          <div className="space-y-2.5">
            <div className="ui-skeleton h-8 w-64 rounded" />
            <div className="ui-skeleton h-3.5 w-[34rem] max-w-full rounded" />
            <div className="ui-skeleton h-4 w-72 max-w-full rounded" />
          </div>
        </div>

        {/* Full-height workbench shell — fixed contract band, then the three-zone
            grid (queue rail | decision | source support): two flexible panes at
            lg, three flexible columns at xl so the focal decision column is never
            crushed by fixed rails. */}
        <div className="ui-card flex flex-col overflow-hidden rounded-lg xl:min-h-0 xl:flex-1">
          {/* Contract band — raised shelf (identity · progress · position + stepper) */}
          <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-3.5 shadow-[0_6px_12px_-9px_rgba(15,23,42,0.3)] sm:px-6">
            <div className="flex-1 space-y-2">
              <div className="ui-skeleton h-2.5 w-24 rounded" />
              <div className="ui-skeleton h-4 w-52 rounded" />
              <div className="ui-skeleton h-2.5 w-40 rounded" />
            </div>
            <div className="space-y-2">
              <div className="ui-skeleton h-2.5 w-20 rounded" />
              <div className="ui-skeleton h-2 w-40 rounded-full" />
            </div>
            <div className="ui-skeleton h-9 w-44 rounded-lg" />
          </div>

          {/* Review unit grid — queue (col 1, both rows) | detail (col 2) + proof
              (col 3) on the panes row | decision footer spanning cols 2-3 below.
              Mirrors the workbench shell geometry: detail+proof are `minmax(0,1fr)`
              and scroll internally, the decision footer is the `auto` row, and the
              source column is widened so the excerpt reads as a contract page. */}
          <div className="grid xl:min-h-0 xl:flex-1 xl:grid-rows-[minmax(0,1fr)_auto] xl:overflow-hidden lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(13rem,16rem)_minmax(23rem,33rem)_minmax(26rem,1fr)]">
            {/* Decision region — cool inspection ground (the footer is a separate
                spanning row, not pinned inside) */}
            <div className="min-h-0 space-y-6 bg-[color:color-mix(in_oklab,var(--surface-cool)_55%,var(--surface-raised))] px-5 py-6 sm:px-6 lg:col-start-1 lg:row-start-1 xl:col-start-2 xl:row-start-1 xl:h-full xl:overflow-hidden xl:border-x xl:border-[var(--border-subtle)]">
              <div className="space-y-2.5">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-7 w-48 rounded" />
                <div className="ui-skeleton h-3 w-56 max-w-full rounded" />
              </div>
              <div className="ui-skeleton h-[13rem] w-full rounded-lg" />
              <div className="ui-skeleton h-12 w-full rounded" />
            </div>

            {/* Source document — dominant column on a warm document ground */}
            <div className="space-y-6 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-inset)_72%,var(--surface-raised))] px-5 py-6 sm:px-7 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-[var(--border-subtle)] lg:border-t-0 xl:col-start-3 xl:row-start-1 xl:h-full xl:border-l-0">
              {/* Source-evidence column header */}
              <div className="ui-skeleton h-3.5 w-28 rounded" />
              <div className="space-y-2.5">
                <div className="ui-skeleton h-3 w-44 rounded" />
                <div className="ui-skeleton h-16 w-full rounded-lg" />
              </div>
              <div className="space-y-2.5">
                <div className="ui-skeleton h-3 w-24 rounded" />
                <div className="ui-skeleton h-72 w-full rounded-lg" />
              </div>
              <div className="space-y-2.5">
                <div className="ui-skeleton h-3 w-40 rounded" />
                <div className="ui-skeleton h-32 w-full rounded-lg" />
              </div>
            </div>

            {/* Decision footer — spans detail + proof on the auto row; a recap line
                above the action buttons */}
            <div className="space-y-3 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-cool)_38%,var(--surface-raised))] px-5 py-3.5 sm:px-7 lg:col-span-2 lg:row-start-2 xl:col-start-2 xl:col-span-2 xl:row-start-2 xl:border-l xl:border-[var(--border-subtle)]">
              <div className="ui-skeleton h-3 w-48 rounded" />
              <div className="flex flex-wrap gap-2">
                <div className="ui-skeleton h-10 w-40 rounded-md" />
                <div className="ui-skeleton h-10 w-28 rounded-md" />
                <div className="ui-skeleton h-10 w-32 rounded-md" />
                <div className="ui-skeleton h-10 w-24 rounded-md" />
              </div>
            </div>

            {/* Queue rail — col 1, spans both rows at xl; full-width strip below up to lg */}
            <div className="border-t border-[var(--border-subtle)] px-5 py-4 sm:px-6 lg:col-span-2 lg:row-start-3 lg:py-5 xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:row-span-2 xl:h-full xl:border-t-0">
              <div className="ui-skeleton h-3.5 w-40 rounded" />
              {/* Search + filter rows */}
              <div className="ui-skeleton mt-3 h-10 w-full rounded-lg" />
              <div className="mt-3 flex flex-col gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="ui-skeleton h-7 w-full rounded-md" />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ui-skeleton h-20 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
