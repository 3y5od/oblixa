export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded bg-zinc-200" />
        <div className="h-9 w-36 rounded bg-zinc-200" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200/90 bg-surface p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-200" />
              <div className="space-y-2">
                <div className="h-3 w-24 rounded bg-zinc-200" />
                <div className="h-6 w-12 rounded bg-zinc-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-xl border border-zinc-200/90 bg-surface" />
        <div className="h-64 rounded-xl border border-zinc-200/90 bg-surface" />
      </div>
    </div>
  );
}
