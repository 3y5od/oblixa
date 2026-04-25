import { LoadingCard } from "@/components/ui/segment-loading";

export default function AccountWorkspaceLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading account workspace. Overview, contracts, and timeline will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <header className="ui-page-header">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-40 rounded" />
            <div className="ui-skeleton h-9 w-72 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-2xl rounded" />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingCard key={i} className="p-4">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton mt-2 h-8 w-20 rounded" />
            </LoadingCard>
          ))}
        </div>

        <section className="ui-page-shell">
          <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="ui-skeleton h-5 w-32 rounded" />
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="ui-skeleton h-4 w-3/4 max-w-full rounded" />
                <div className="ui-skeleton mt-2 h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
