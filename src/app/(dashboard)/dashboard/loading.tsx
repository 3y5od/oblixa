import { LoadingCard } from "@/components/ui/segment-loading";

export default function DashboardLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading dashboard. High-signal cards and operational queues will appear shortly.
      </div>
      <div className="min-h-0" aria-hidden aria-busy="true">
        <div className="ui-page-stack">
        <header className="ui-page-header-compact">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="ui-skeleton h-4 w-24 rounded" />
            <div className="ui-skeleton h-9 w-52 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-2xl rounded" />
          </div>
          <div className="ui-page-actions">
            <div className="ui-skeleton h-10 w-32 rounded-lg" />
            <div className="ui-skeleton h-10 w-28 rounded-lg" />
          </div>
        </header>
        <section className="ui-page-shell space-y-3">
          <div className="space-y-2">
            <div className="ui-skeleton h-4 w-24 rounded" />
            <div className="ui-skeleton h-7 w-44 rounded" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingCard key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="ui-skeleton h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <div className="ui-skeleton h-3 w-24 rounded" />
                    <div className="ui-skeleton h-6 w-12 rounded" />
                  </div>
                </div>
              </LoadingCard>
            ))}
          </div>
        </section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LoadingCard className="h-64" />
          <LoadingCard className="h-64" />
        </div>
      </div>
      </div>
    </>
  );
}
