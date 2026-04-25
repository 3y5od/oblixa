import { LoadingCard, SegmentLoading } from "@/components/ui/segment-loading";

export default function AuthSegmentLoading() {
  return (
    <SegmentLoading label="Loading authentication flow. Sign-in content will appear shortly." shellClassName="bg-canvas" bodyClassName="max-w-md">
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <div className="ui-skeleton mx-auto h-3 w-24 rounded" />
          <div className="ui-skeleton mx-auto h-8 w-44 rounded" />
          <div className="ui-skeleton mx-auto h-3 w-56 max-w-full rounded" />
        </div>
        <LoadingCard className="ui-page-shell space-y-3 p-6">
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-10 w-32 rounded-lg" />
        </LoadingCard>
      </div>
    </SegmentLoading>
  );
}
