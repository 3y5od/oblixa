import { LoadingCard } from "@/components/ui/segment-loading";

export default function WorkHubLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading work queue. Lenses, queue rows, and inline actions will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <header className="ui-page-header-compact">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-24 rounded" />
            <div className="ui-skeleton h-9 w-52 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-2xl rounded" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-8 w-24 rounded-full" />
              ))}
            </div>
            <div className="ui-skeleton h-4 w-80 max-w-full rounded" />
          </div>
        </header>

        <section className="ui-page-shell space-y-3">
          <div className="space-y-2">
            <div className="ui-skeleton h-4 w-20 rounded" />
            <div className="ui-skeleton h-7 w-44 rounded" />
            <div className="ui-skeleton h-4 w-72 max-w-full rounded" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingCard key={i} className="p-4">
                <div className="space-y-3">
                  <div className="ui-skeleton h-4 w-24 rounded" />
                  <div className="ui-skeleton h-7 w-20 rounded" />
                  <div className="ui-skeleton h-4 w-28 rounded" />
                </div>
              </LoadingCard>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <LoadingCard key={sectionIndex} className="p-0">
              <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-6 py-4">
                <div className="ui-skeleton h-5 w-40 rounded" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-b border-[var(--border-subtle)] px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      <div className="ui-skeleton h-4 w-56 max-w-full rounded" />
                      <div className="ui-skeleton h-4 w-32 rounded" />
                    </div>
                    <div className="ui-skeleton h-8 w-28 rounded-lg" />
                  </div>
                </div>
              ))}
            </LoadingCard>
          ))}
        </section>
      </div>
    </>
  );
}
