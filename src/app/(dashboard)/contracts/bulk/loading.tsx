export default function BulkImportLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading bulk import. Upload form and job history will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-28 rounded" />
          <div className="ui-skeleton h-9 w-48 max-w-full rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface p-6 shadow-[var(--shadow-1)]">
          <div className="ui-skeleton h-32 w-full rounded-xl" />
          <div className="mt-4 ui-skeleton h-10 w-36 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
          <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-6 py-3">
            <div className="ui-skeleton h-4 w-44 rounded" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="ui-skeleton h-4 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
