import { LoadingCard } from "@/components/ui/segment-loading";

export default function ContractsLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading contracts. Filters, saved views, and table rows will appear shortly.
      </div>
      <div className="min-h-0" aria-hidden aria-busy="true">
        <div className="ui-page-stack">
        <header className="ui-page-header-compact">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="ui-skeleton h-4 w-24 rounded" />
            <div className="ui-skeleton h-9 w-48 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-2xl rounded" />
          </div>
          <div className="ui-page-actions">
            <div className="ui-skeleton h-10 w-32 rounded-lg" />
            <div className="ui-skeleton h-10 w-28 rounded-lg" />
            <div className="ui-skeleton h-10 w-28 rounded-lg" />
            <div className="ui-skeleton h-10 w-28 rounded-lg" />
          </div>
        </header>

        <section className="ui-page-shell space-y-3">
          <div className="space-y-2">
            <div className="ui-skeleton h-4 w-20 rounded" />
            <div className="ui-skeleton h-7 w-40 rounded" />
            <div className="ui-skeleton h-4 w-80 max-w-full rounded" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} className="p-4">
                <div className="space-y-3">
                  <div className="ui-skeleton h-4 w-20 rounded" />
                  <div className="ui-skeleton h-7 w-24 rounded" />
                  <div className="ui-skeleton h-4 w-32 rounded" />
                </div>
              </LoadingCard>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="ui-page-shell space-y-4 p-4 md:p-5">
              <div className="ui-skeleton h-4 w-16 rounded" />
              <div className="ui-skeleton h-10 w-full rounded" />
              <div className="ui-skeleton h-4 w-20 rounded" />
              <div className="ui-skeleton h-10 w-full rounded" />
              <div className="ui-skeleton h-4 w-16 rounded" />
              <div className="ui-skeleton h-10 w-full rounded" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ui-skeleton h-8 w-20 rounded-full" />
                ))}
              </div>
            </div>
          </aside>

          <section className="ui-table-shell">
            <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="ui-skeleton h-5 w-48 rounded" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-b border-[var(--border-subtle)] px-6 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="ui-skeleton h-4 w-48 max-w-full rounded" />
                  <div className="ui-skeleton h-4 w-24 rounded" />
                  <div className="ui-skeleton h-4 w-24 rounded" />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
      </div>
    </>
  );
}
