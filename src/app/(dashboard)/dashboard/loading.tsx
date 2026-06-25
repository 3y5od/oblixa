// Skeleton mirrors the Core dashboard structure:
// editorial header + trust line -> operational snapshot ledger -> stacked
// priority ledgers -> two-up monitoring -> full-width data-completeness surface.
export default function DashboardLoading() {
  const sectionCards = Array.from({ length: 5 });
  const renderCard = (key: number, tall: boolean) => (
    <div key={key} className="ui-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] px-4 py-3">
        <div className="ui-skeleton h-5 w-44 rounded" />
        <div className="ui-skeleton h-6 w-28 rounded-md" />
      </div>
      <div className="p-3">
        <div className={`ui-skeleton rounded-xl ${tall ? "h-40" : "h-24"}`} />
      </div>
    </div>
  );

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading dashboard. The operational snapshot and queues will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto w-full max-w-[1440px] gap-4" aria-hidden aria-busy="true">
        {/* Editorial header: quiet route label, serif title, lead, the paired
            intake actions, and the trust line beneath the rule. */}
        <div className="flex flex-col gap-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_65%,transparent)] pb-5">
          <div className="flex flex-col gap-x-6 gap-y-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2.5">
              <div className="ui-skeleton h-2.5 w-20 rounded" />
              <div className="ui-skeleton h-9 w-64 max-w-full rounded" />
              <div className="ui-skeleton h-4 w-80 max-w-full rounded" />
            </div>
            <div className="flex gap-2">
              <div className="ui-skeleton h-9 w-36 rounded-[4px]" />
              <div className="ui-skeleton h-9 w-36 rounded-[4px]" />
            </div>
          </div>
          <div className="ui-skeleton h-3.5 w-96 max-w-full rounded" />
        </div>
        {/* Operational snapshot — one bordered surface, header band + a two-column
            condition register (six tight rows ruled by 1px grid gaps); each row is
            a tone left rule, count + statement, and its definition. */}
        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_50%,var(--surface-raised))] px-4 py-2.5">
            <div className="ui-skeleton h-3 w-36 rounded" />
            <div className="ui-skeleton h-3 w-48 max-w-full rounded" />
          </div>
          <div className="grid grid-cols-1 gap-px bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-baseline gap-2.5 bg-[var(--surface-raised)] py-2.5 pl-3.5 pr-3.5">
                <div className="ui-skeleton h-[1.1rem] w-[1.1rem] shrink-0 translate-y-0.5 rounded" />
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <div className="ui-skeleton h-6 w-44 max-w-full shrink-0 rounded" />
                  <div className="ui-skeleton h-3.5 w-[18rem] max-w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Priority work — stacked full width: the review artifact (tall) over the
            task ledger. */}
        <div className="flex min-w-0 flex-col gap-4">
          {sectionCards.slice(0, 2).map((_, i) => renderCard(i, i === 0))}
        </div>
        {/* Monitoring — date ledger beside a quieter activity rail. */}
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,1fr)]">
          {sectionCards.slice(2, 4).map((_, i) => renderCard(i + 2, false))}
        </div>
        {/* Data completeness — full-width inspection surface. */}
        {sectionCards.slice(4).map((_, i) => renderCard(i + 4, false))}
      </div>
    </>
  );
}
