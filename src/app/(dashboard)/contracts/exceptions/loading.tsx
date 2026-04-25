export default function ExceptionsLedgerLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading exception ledger. Severity filters and exception rows will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-28 rounded" />
          <div className="ui-skeleton h-9 w-56 max-w-full rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ui-skeleton h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
          <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-6 py-3">
            <div className="ui-skeleton h-4 w-44 rounded" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="ui-skeleton h-4 w-full max-w-lg rounded" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
