import { LoadingCard, SegmentLoading } from "@/components/ui/segment-loading";

export default function MarketingLoading() {
  return (
    <SegmentLoading label="Loading page. Public content will appear shortly." shellClassName="bg-canvas" bodyClassName="max-w-lg">
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <div className="ui-skeleton mx-auto h-3 w-24 rounded" />
          <div className="ui-skeleton mx-auto h-8 w-56 max-w-full rounded" />
          <div className="ui-skeleton mx-auto h-3 w-72 max-w-full rounded" />
        </div>
        <LoadingCard className="ui-page-shell space-y-3 p-6">
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-28 w-full rounded-xl" />
        </LoadingCard>
      </div>
    </SegmentLoading>
  );
}
