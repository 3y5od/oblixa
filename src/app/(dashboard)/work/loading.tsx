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
        <LoadingCard className="overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="ui-skeleton h-5 w-28 rounded" />
            <div className="ui-skeleton h-6 w-24 rounded-md" />
          </div>
          <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-7 w-20 rounded-md" />
            ))}
          </div>
          <div className="grid gap-3 px-4 py-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ui-skeleton h-10 rounded-lg" />
            ))}
          </div>
          <div className="border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-6 bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))] px-4 py-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-3 w-16 rounded" />
              <div className="ui-skeleton h-3 w-16 rounded" />
              <div className="ui-skeleton h-3 w-16 rounded" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] px-4 py-3"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="ui-skeleton h-2.5 w-16 rounded" />
                  <div className="ui-skeleton h-4 w-64 max-w-full rounded" />
                  <div className="ui-skeleton h-3 w-40 rounded" />
                </div>
                <div className="hidden gap-6 md:flex">
                  <div className="ui-skeleton h-4 w-16 rounded" />
                  <div className="ui-skeleton h-4 w-16 rounded" />
                  <div className="ui-skeleton h-6 w-20 rounded-full" />
                </div>
                <div className="ui-skeleton h-8 w-40 rounded-lg" />
              </div>
            ))}
          </div>
        </LoadingCard>
      </div>
    </>
  );
}
