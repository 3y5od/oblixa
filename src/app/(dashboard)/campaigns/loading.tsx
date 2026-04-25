import { LoadingCard } from "@/components/ui/segment-loading";

export default function CampaignsSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading campaigns. List filters, simulations, and campaign cards will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <header className="ui-page-header">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-32 rounded" />
            <div className="ui-skeleton h-9 w-64 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-2xl rounded" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-8 w-24 rounded-full" />
              ))}
            </div>
          </div>
        </header>

        <section className="ui-page-shell space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} className="p-4">
                <div className="space-y-2">
                  <div className="ui-skeleton h-4 w-20 rounded" />
                  <div className="ui-skeleton h-6 w-3/4 max-w-full rounded" />
                </div>
                <div className="ui-skeleton mt-4 h-20 rounded-lg" />
              </LoadingCard>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-1 py-3">
            <div className="ui-skeleton h-5 w-40 rounded" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ui-card overflow-hidden">
                <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-4 py-3">
                  <div className="ui-skeleton h-4 w-3/4 max-w-full rounded" />
                </div>
                <div className="space-y-3 p-4">
                  <div className="ui-skeleton h-4 w-full rounded" />
                  <div className="ui-skeleton h-4 w-2/3 rounded" />
                  <div className="ui-skeleton h-8 w-28 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
