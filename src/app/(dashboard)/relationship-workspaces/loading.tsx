export default function RelationshipWorkspacesIndexLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading relationship workspaces. Accounts and relationship cards will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <header className="ui-page-header">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-40 rounded" />
            <div className="ui-skeleton h-9 w-64 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-xl rounded" />
          </div>
        </header>

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
