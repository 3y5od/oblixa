import { LoadingCard } from "@/components/ui/segment-loading";

export default function PersonaDashboardLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading persona dashboard. Persona controls, work views, and queue content will appear shortly.
      </div>
      <div className="ui-page-stack gap-3" aria-hidden aria-busy="true">
        <LoadingCard className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl space-y-2">
              <div className="ui-skeleton h-3 w-20 rounded-full" />
              <div className="ui-skeleton h-8 w-44 rounded-lg" />
              <div className="ui-skeleton h-4 w-full max-w-xl rounded-full" />
              <div className="ui-skeleton h-3 w-36 rounded-full" />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="ui-skeleton h-10 w-56 rounded-xl" />
              <div className="ui-skeleton h-10 w-28 rounded-xl" />
            </div>
          </div>
        </LoadingCard>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="ui-skeleton h-5 w-24 rounded-full" />
            <div className="flex flex-wrap gap-2">
              <div className="ui-skeleton h-8 w-20 rounded-full" />
              <div className="ui-skeleton h-8 w-28 rounded-full" />
              <div className="ui-skeleton h-8 w-32 rounded-full" />
              <div className="ui-skeleton h-8 w-28 rounded-full" />
            </div>
          </div>
        </div>
        <LoadingCard>
          <div className="space-y-3 p-3">
            <div className="space-y-2 border-b border-[var(--border-subtle)] pb-3">
              <div className="ui-skeleton h-3 w-24 rounded-full" />
              <div className="ui-skeleton h-6 w-52 rounded-lg" />
              <div className="ui-skeleton h-3 w-full max-w-lg rounded-full" />
            </div>
            <div className="ui-skeleton h-16 w-full rounded-2xl" />
          </div>
        </LoadingCard>
      </div>
    </>
  );
}
