// Skeleton mirrors the Core dashboard structure:
// header -> six-card command strip -> five-section board.
export default function DashboardLoading() {
  const sectionSpans = [
    "xl:col-span-7",
    "xl:col-span-5",
    "xl:col-span-5",
    "xl:col-span-3",
    "xl:col-span-4",
  ];

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading dashboard. High-signal cards and operational queues will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        {/* Page header */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="min-w-0 space-y-2">
            <div className="ui-skeleton h-3 w-24 rounded" />
            <div className="ui-skeleton h-8 w-52 rounded" />
            <div className="ui-skeleton h-3 w-80 max-w-full rounded" />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {/* Upload contract + Import CSV CTAs */}
            <div className="ui-skeleton h-10 w-36 rounded-xl" />
            <div className="ui-skeleton h-10 w-28 rounded-xl" />
          </div>
        </div>
        {/* Six Core top cards */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--border-card)_72%,transparent)]">
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-20" />
            ))}
          </div>
        </div>
        {/* Five Core main sections */}
        <div className="grid items-start gap-5 xl:grid-cols-12">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`${sectionSpans[i]} overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]`}
            >
              <div className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-4 py-3.5">
                <div className="ui-skeleton h-6 w-44 rounded" />
                <div className="ui-skeleton h-7 w-28 rounded-md" />
              </div>
              <div className="p-3">
                <div className={`ui-skeleton rounded-xl ${i === 4 ? "h-28" : "h-24"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
