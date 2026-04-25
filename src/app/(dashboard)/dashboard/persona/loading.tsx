import { LoadingCard } from "@/components/ui/segment-loading";

export default function PersonaDashboardLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading persona dashboard. Role lanes and digest cards will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <LoadingCard>
          <div className="ui-skeleton h-20 w-full rounded-[1.25rem]" />
        </LoadingCard>
        <LoadingCard>
          <div className="ui-skeleton h-28 w-full rounded-[1.25rem]" />
        </LoadingCard>
        <LoadingCard>
          <div className="ui-skeleton h-56 w-full rounded-[1.25rem]" />
        </LoadingCard>
        <LoadingCard>
          <div className="ui-skeleton h-72 w-full rounded-[1.25rem]" />
        </LoadingCard>
      </div>
    </>
  );
}
