import { LoadingCard } from "@/components/ui/segment-loading";

export default function ReportsHistoryLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading contract reports history. Digest runs and exports will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <LoadingCard>
          <div className="ui-skeleton h-20 w-full rounded-xl" />
        </LoadingCard>
        <div className="grid gap-6 lg:grid-cols-2">
          <LoadingCard>
            <div className="ui-skeleton h-96 w-full rounded-xl" />
          </LoadingCard>
          <LoadingCard>
            <div className="ui-skeleton h-96 w-full rounded-xl" />
          </LoadingCard>
        </div>
      </div>
    </>
  );
}
