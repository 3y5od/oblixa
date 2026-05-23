import { LoadingCard } from "@/components/ui/segment-loading";

export default function ContractsAnalyticsLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading contract analytics. Charts and portfolio slices will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="ui-skeleton h-8 w-56 rounded" />
          <div className="ui-skeleton h-9 w-36 rounded-lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <LoadingCard key={i} className="p-4">
              <div className="ui-skeleton h-24 w-full rounded-lg" />
            </LoadingCard>
          ))}
        </div>
        <LoadingCard>
          <div className="ui-skeleton h-80 w-full rounded-xl" />
        </LoadingCard>
      </div>
    </>
  );
}
