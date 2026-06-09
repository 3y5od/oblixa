// Skeleton mirrors the Core dashboard structure:
// header -> six-card command strip -> two stacked section columns (3 + 2).
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
        Loading dashboard. High-signal cards and operational queues will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto w-full max-w-[1440px] gap-4" aria-hidden aria-busy="true">
        {/* Page header */}
        {/* Mirrors the canonical flat page identity: 40px icon-tile, eyebrow,
            2rem h1, lead, and a paired pill-button cluster (§5.1). */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-52 rounded" />
              <div className="ui-skeleton h-4 w-64 max-w-full rounded-full" />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="ui-skeleton h-10 w-40 rounded-full" />
            <div className="ui-skeleton h-10 w-36 rounded-full" />
          </div>
        </div>
        {/* Six Core top cards — single bordered surface, internal spacing */}
        <div className="ui-card-raised overflow-hidden">
          <div className="grid grid-cols-2 gap-1 p-1 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-[80px] rounded-lg" />
            ))}
          </div>
        </div>
        {/* Five Core main sections — two columns (2 + 2) then Data Gaps full width */}
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
