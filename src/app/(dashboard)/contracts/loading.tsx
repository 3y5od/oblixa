export default function ContractsLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="ui-skeleton h-8 w-32 rounded" />
        <div className="ui-skeleton h-9 w-36 rounded" />
      </div>
      <div className="flex gap-4">
        <div className="ui-skeleton h-9 w-64 rounded" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="ui-skeleton h-8 w-20 rounded" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
        <div className="border-b border-zinc-200/80 bg-zinc-50/60 px-6 py-3">
          <div className="ui-skeleton h-4 w-full rounded" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-[var(--border-subtle)] px-6 py-4">
            <div className="ui-skeleton h-4 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
