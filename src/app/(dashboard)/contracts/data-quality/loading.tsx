import { LoadingCard } from "@/components/ui/segment-loading";

export default function DataQualityLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading data quality. Gap summaries and remediation links will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="ui-skeleton h-8 w-48 rounded" />
          <div className="ui-skeleton h-9 w-32 rounded-lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingCard key={i} className="p-4">
              <div className="flex items-center gap-3">
                <div className="ui-skeleton h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <div className="ui-skeleton h-3 w-20 rounded" />
                  <div className="ui-skeleton h-6 w-10 rounded" />
                </div>
              </div>
            </LoadingCard>
          ))}
        </div>
        <LoadingCard>
          <div className="ui-skeleton h-72 w-full rounded-[1.25rem]" />
        </LoadingCard>
        <LoadingCard>
          <div className="ui-skeleton h-72 w-full rounded-[1.25rem]" />
        </LoadingCard>
      </div>
    </>
  );
}
