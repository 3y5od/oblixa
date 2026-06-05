import { LoadingCard, SegmentLoading } from "@/components/ui/segment-loading";

export default function AuthSegmentLoading() {
  return (
    <SegmentLoading
      label="Loading authentication flow. Sign-in content will appear shortly."
      shellClassName="bg-canvas"
      bodyClassName="max-w-[26rem]"
    >
      <div className="space-y-6">
        {/* Header bar: back-home pill + brand lockup */}
        <div className="flex items-center justify-between gap-4">
          <div className="ui-skeleton h-8 w-28 rounded-full" />
          <div className="ui-skeleton h-8 w-24 rounded-lg" />
        </div>

        {/* Left-aligned identity: eyebrow + title + intro */}
        <div className="space-y-2">
          <div className="ui-skeleton h-2.5 w-28 rounded" />
          <div className="ui-skeleton h-7 w-56 max-w-full rounded" />
          <div className="ui-skeleton h-3 w-72 max-w-full rounded" />
        </div>

        {/* Focal form card */}
        <LoadingCard className="space-y-4 rounded-2xl border p-5 sm:p-6">
          <div className="ui-skeleton h-11 w-full rounded-lg" />
          <div className="ui-skeleton h-11 w-full rounded-lg" />
          <div className="ui-skeleton h-12 w-full rounded-lg" />
        </LoadingCard>
      </div>
    </SegmentLoading>
  );
}
