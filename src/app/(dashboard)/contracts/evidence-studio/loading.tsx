export default function EvidenceStudioLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading evidence studio. Templates and live requirement queue will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-32 rounded" />
          <div className="ui-skeleton h-9 w-56 max-w-full rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-5 shadow-[var(--shadow-1)]">
            <div className="ui-skeleton h-5 w-40 rounded" />
            <div className="mt-4 space-y-3">
              <div className="ui-skeleton h-10 w-full rounded-lg" />
              <div className="ui-skeleton h-24 w-full rounded-xl" />
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
            <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="ui-skeleton h-4 w-36 rounded" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-b border-[var(--border-subtle)] px-4 py-3">
                <div className="ui-skeleton h-4 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
