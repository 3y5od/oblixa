export default function RelationshipWorkspacesIndexLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading relationship workspaces. Accounts and relationship cards will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="ui-page-header flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-40 rounded" />
              <div className="ui-skeleton h-8 w-64 max-w-full rounded" />
              <div className="ui-skeleton h-3 max-w-xl rounded" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ui-card overflow-hidden">
              <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-4 py-3">
                <div className="ui-skeleton h-4 w-3/4 max-w-full rounded" />
              </div>
              <div className="space-y-2 p-4">
                <div className="ui-skeleton h-3 w-full rounded" />
                <div className="ui-skeleton h-3 w-4/5 rounded" />
                <div className="ui-skeleton mt-3 h-8 w-32 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
