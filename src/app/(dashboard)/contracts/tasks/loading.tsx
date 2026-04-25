import { LoadingCard } from "@/components/ui/segment-loading";

export default function ContractTasksLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading contract tasks. Obligations and execution items will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <LoadingCard>
          <div className="ui-skeleton h-24 w-full rounded-[1.25rem]" />
        </LoadingCard>
        <LoadingCard>
          <div className="ui-skeleton h-48 w-full rounded-[1.25rem]" />
        </LoadingCard>
        <LoadingCard>
          <div className="ui-skeleton h-80 w-full rounded-[1.25rem]" />
        </LoadingCard>
      </div>
    </>
  );
}
