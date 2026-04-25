import { LoadingCard, SegmentLoading } from "@/components/ui/segment-loading";

export default function ExternalActionLoading() {
  return (
    <SegmentLoading
      label="Loading external action. The secure form will appear shortly."
      shellClassName="bg-canvas"
      bodyClassName="max-w-lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="ui-skeleton h-3 w-32 rounded" />
          <div className="ui-skeleton h-8 w-2/3 max-w-full rounded" />
          <div className="ui-skeleton h-3 max-w-md rounded" />
        </div>
        <LoadingCard className="ui-page-shell space-y-3 p-6">
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-24 w-full rounded-lg" />
          <div className="ui-skeleton h-10 w-36 rounded-lg" />
        </LoadingCard>
      </div>
    </SegmentLoading>
  );
}
