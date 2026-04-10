const cardShell = "rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]";

export default function DataQualityLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="ui-skeleton h-8 w-48 rounded" />
        <div className="ui-skeleton h-9 w-32 rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`p-4 ${cardShell}`}>
            <div className="flex items-center gap-3">
              <div className="ui-skeleton h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-20 rounded" />
                <div className="ui-skeleton h-6 w-10 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className={`ui-skeleton h-72 ${cardShell}`} />
      <div className={`ui-skeleton h-72 ${cardShell}`} />
    </div>
  );
}
