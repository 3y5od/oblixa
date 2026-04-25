import { LoadingCard } from "@/components/ui/segment-loading";

export default function ReviewQueueLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading review queue. Field editors and save actions will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <header className="ui-page-header flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-28 rounded" />
            <div className="ui-skeleton h-9 w-52 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-2xl rounded" />
          </div>
          <div className="ui-skeleton h-10 w-32 rounded-lg" />
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingCard key={i} className="p-4">
              <div className="space-y-3">
                <div className="ui-skeleton h-4 w-24 rounded" />
                <div className="ui-skeleton h-7 w-24 rounded" />
                <div className="ui-skeleton h-4 w-36 rounded" />
              </div>
            </LoadingCard>
          ))}
        </section>

        <section className="ui-card-hero overflow-hidden">
          <div className="space-y-5 border-b border-[var(--border-subtle)]/90 px-5 py-6 md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="ui-skeleton h-4 w-20 rounded" />
                <div className="ui-skeleton h-7 w-64 max-w-full rounded" />
                <div className="ui-skeleton h-4 max-w-3xl rounded" />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="ui-skeleton h-10 w-40 rounded-lg" />
                <div className="ui-skeleton h-10 w-36 rounded-lg" />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingCard key={i} className="px-4 py-3">
                  <div className="space-y-3">
                    <div className="ui-skeleton h-4 w-20 rounded" />
                    <div className="ui-skeleton h-6 w-28 rounded" />
                    <div className="ui-skeleton h-4 w-32 rounded" />
                  </div>
                </LoadingCard>
              ))}
            </div>
          </div>
        </section>

        <LoadingCard className="p-0">
          <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-6 py-4">
            <div className="ui-skeleton h-5 w-52 rounded" />
          </div>
          <div className="space-y-4 p-6">
            <div className="ui-skeleton h-24 w-full rounded-xl" />
            <div className="ui-skeleton h-32 w-full rounded-xl" />
            <div className="ui-skeleton h-10 w-40 rounded-lg" />
          </div>
        </LoadingCard>
      </div>
    </>
  );
}
