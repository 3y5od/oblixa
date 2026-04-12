const cardShell = "rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]";

export default function ContractsAnalyticsLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="ui-skeleton h-8 w-56 rounded" />
        <div className="ui-skeleton h-9 w-36 rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`p-4 ${cardShell}`}>
            <div className="ui-skeleton h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className={`ui-skeleton h-80 ${cardShell}`} />
    </div>
  );
}
