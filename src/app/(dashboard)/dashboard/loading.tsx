// Skeleton mirrors the Core dashboard structure:
// header -> six-card command strip -> two stacked section columns (3 + 2).
export default function DashboardLoading() {
  const sectionCards = Array.from({ length: 5 });
  const renderCard = (key: number, tall: boolean) => (
    <div
      key={key}
      className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
    >
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
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        {/* Page header */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="ui-skeleton h-9 w-9 shrink-0 rounded-[10px]" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-7 w-48 rounded" />
              <div className="ui-skeleton h-4 w-64 max-w-full rounded-full" />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <div className="ui-skeleton h-10 w-36 rounded-xl" />
            <div className="ui-skeleton h-10 w-28 rounded-xl" />
          </div>
        </div>
        {/* Six Core top cards — single bordered surface, internal spacing */}
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="grid grid-cols-1 gap-1 p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-[72px] rounded-lg" />
            ))}
          </div>
        </div>
        {/* Five Core main sections — two stacked columns (3 main + 2 rail) */}
        <div className="grid items-start gap-4 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-7">
            {sectionCards.slice(0, 3).map((_, i) => renderCard(i, false))}
          </div>
          <div className="flex flex-col gap-4 xl:col-span-5">
            {sectionCards.slice(3).map((_, i) => renderCard(i + 3, i === 1))}
          </div>
        </div>
      </div>
    </>
  );
}
