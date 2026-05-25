import { LoadingCard } from "@/components/ui/segment-loading";

export default function WorkLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading Work.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="ui-page-header flex items-start gap-3.5">
          <div className="ui-skeleton h-10 w-10 rounded-xl" />
          <div className="min-w-0 space-y-2">
            <div className="ui-skeleton h-3 w-28 rounded" />
            <div className="ui-skeleton h-8 w-28 rounded" />
          </div>
        </div>
        <LoadingCard className="ui-page-shell overflow-hidden p-0">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <div className="ui-skeleton h-6 w-28 rounded" />
          </div>
          <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-8 w-24 rounded-full" />
            ))}
          </div>
          <div className="grid gap-3 px-5 py-4 md:grid-cols-5 lg:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-10 rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-t border-[var(--border-subtle)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <div className="ui-skeleton h-4 w-56 max-w-full rounded" />
                  <div className="ui-skeleton h-4 w-32 rounded" />
                </div>
                <div className="ui-skeleton h-8 w-48 rounded-lg" />
              </div>
            </div>
          ))}
        </LoadingCard>
      </div>
    </>
  );
}
