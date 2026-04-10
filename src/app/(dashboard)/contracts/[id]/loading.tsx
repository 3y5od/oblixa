function MetricCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-4 shadow-[var(--shadow-1)]">
      <div className="flex items-center gap-3">
        <div className="ui-skeleton h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="ui-skeleton h-3 w-24 rounded" />
          <div className="ui-skeleton h-6 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function ContractDetailLoading() {
  return (
    <div className="ui-page-stack" aria-hidden>
      <div className="flex items-center gap-4">
        <div className="ui-skeleton h-8 w-8 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="ui-skeleton h-7 w-64 max-w-full rounded" />
          <div className="ui-skeleton h-4 w-40 max-w-full rounded" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
        <div className="border-b border-zinc-200/80 bg-zinc-50/60 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-8 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <div className="h-4" />
      </div>
      <div className="grid grid-cols-1 gap-7 md:gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
            <div className="border-b border-zinc-200/80 bg-zinc-50/60 px-6 py-4">
              <div className="ui-skeleton h-5 w-40 rounded" />
            </div>
            <div className="space-y-4 p-6">
              <div className="ui-skeleton h-32 w-full rounded-xl" />
              <div className="ui-skeleton h-24 w-full rounded-xl" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-5 shadow-[var(--shadow-1)]">
            <div className="ui-skeleton h-4 w-28 rounded" />
            <div className="mt-4 space-y-3">
              <div className="ui-skeleton h-10 w-full rounded-lg" />
              <div className="ui-skeleton h-10 w-full rounded-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-5 shadow-[var(--shadow-1)]">
            <div className="ui-skeleton h-4 w-32 rounded" />
            <div className="mt-4 ui-skeleton h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
