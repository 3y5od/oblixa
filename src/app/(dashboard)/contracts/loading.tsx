export default function ContractsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-zinc-200" />
        <div className="h-9 w-36 rounded bg-zinc-200" />
      </div>
      <div className="flex gap-4">
        <div className="h-9 w-64 rounded bg-zinc-200" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded bg-zinc-200" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-3">
          <div className="h-4 w-full rounded bg-zinc-200" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-100 px-6 py-4">
            <div className="h-4 w-full rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
