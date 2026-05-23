import { LoadingCard } from "@/components/ui/segment-loading";

export default function CounterpartyWorkspaceLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading counterparty workspace. Overview and related contracts will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="ui-page-header flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-44 rounded" />
              <div className="ui-skeleton h-8 w-80 max-w-full rounded" />
              <div className="ui-skeleton h-3 max-w-2xl rounded" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <LoadingCard key={i} className="p-5">
              <div className="ui-skeleton h-4 w-28 rounded" />
              <div className="ui-skeleton mt-3 h-16 rounded-lg" />
            </LoadingCard>
          ))}
        </div>

        <section className="ui-page-shell">
          <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="ui-skeleton h-5 w-40 rounded" />
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <div className="ui-skeleton h-4 w-2/3 max-w-full rounded" />
                <div className="ui-skeleton mt-2 h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
