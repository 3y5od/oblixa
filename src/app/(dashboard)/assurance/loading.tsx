import { LoadingCard } from "@/components/ui/segment-loading";

export default function AssuranceSegmentLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading assurance. Hub sections and scorecards will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-32 rounded" />
          <div className="ui-skeleton h-9 w-64 rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LoadingCard className="h-36" />
          <LoadingCard className="h-36" />
          <LoadingCard className="h-36" />
        </div>
        <LoadingCard className="h-48" />
      </div>
    </>
  );
}
