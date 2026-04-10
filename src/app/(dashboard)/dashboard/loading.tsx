export default function DashboardLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="ui-skeleton h-8 w-36 rounded" />
        <div className="ui-skeleton h-9 w-36 rounded" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-4 shadow-[var(--shadow-1)]">
            <div className="flex items-center gap-3">
              <div className="ui-skeleton h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <div className="ui-skeleton h-3 w-24 rounded" />
                <div className="ui-skeleton h-6 w-12 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="ui-skeleton h-64 rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]" />
        <div className="ui-skeleton h-64 rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]" />
      </div>
    </div>
  );
}
