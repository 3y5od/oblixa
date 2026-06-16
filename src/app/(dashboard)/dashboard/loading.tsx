// Skeleton mirrors the Core dashboard structure:
// editorial header -> operational snapshot ledger -> grouped section ledgers.
export default function DashboardLoading() {
  const sectionCards = Array.from({ length: 5 });
  const renderCard = (key: number, tall: boolean) => (
    <div key={key} className="ui-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] px-4 py-3">
        <div className="ui-skeleton h-5 w-40 rounded" />
        <div className="ui-skeleton h-6 w-24 rounded-md" />
      </div>
      <div className="p-2">
        <div className={`ui-skeleton rounded-xl ${tall ? "h-24" : "h-20"}`} />
      </div>
    </div>
  );

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading dashboard. The operational snapshot and queues will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto w-full max-w-[1440px] gap-4" aria-hidden aria-busy="true">
        {/* Editorial header: quiet route label, serif title, lead, workspace-state
            line, and the paired intake actions over a trust note (no icon tile). */}
        <div className="flex flex-col gap-x-6 gap-y-5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_65%,transparent)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2.5">
            <div className="ui-skeleton h-2.5 w-20 rounded" />
            <div className="ui-skeleton h-9 w-64 max-w-full rounded" />
            <div className="ui-skeleton h-4 w-80 max-w-full rounded" />
            <div className="ui-skeleton h-3.5 w-56 max-w-full rounded" />
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="flex gap-2">
              <div className="ui-skeleton h-9 w-36 rounded-[4px]" />
              <div className="ui-skeleton h-9 w-36 rounded-[4px]" />
            </div>
            <div className="ui-skeleton h-3 w-48 max-w-full rounded" />
          </div>
        </div>
        {/* Operational snapshot — one bordered surface, header band + six ledger
            cells ruled by 1px grid gaps. */}
        <div className="ui-card-raised overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] px-4 py-2.5">
            <div className="ui-skeleton h-3 w-36 rounded" />
            <div className="ui-skeleton h-3 w-48 max-w-full rounded" />
          </div>
          <div className="grid grid-cols-1 gap-px bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[var(--surface-raised)] px-4 py-3.5">
                <div className="ui-skeleton h-8 w-16 rounded" />
                <div className="ui-skeleton mt-3 h-3.5 w-32 max-w-full rounded" />
                <div className="ui-skeleton mt-2 h-4 w-24 rounded-[3px]" />
              </div>
            ))}
          </div>
        </div>
        {/* Five Core main sections — two columns (2 + 2) then Missing Details full width */}
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 xl:col-span-7">
            {sectionCards.slice(0, 2).map((_, i) => renderCard(i, false))}
          </div>
          <div className="flex min-w-0 flex-col gap-3 xl:col-span-5">
            {sectionCards.slice(2, 4).map((_, i) => renderCard(i + 2, i === 1))}
          </div>
        </div>
        {sectionCards.slice(4).map((_, i) => renderCard(i + 4, false))}
      </div>
    </>
  );
}
