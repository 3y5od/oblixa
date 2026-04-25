import { LoadingCard } from "@/components/ui/segment-loading";

export default function SettingsLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading settings. Workspace preferences and visibility controls will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto max-w-4xl" aria-hidden aria-busy="true">
        <div className="space-y-3">
          <div className="ui-skeleton h-4 w-24 rounded" />
          <div className="ui-skeleton h-9 w-48 rounded" />
          <div className="ui-skeleton h-4 max-w-xl rounded" />
        </div>
        <LoadingCard className="space-y-4 p-6">
          <div className="ui-skeleton h-6 w-20 rounded" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
            <div className="ui-skeleton h-10 w-full rounded-lg" />
            <div className="ui-skeleton h-10 w-full rounded-lg" />
          </div>
        </LoadingCard>
        <LoadingCard className="space-y-4 p-6">
          <div className="ui-skeleton h-6 w-32 rounded" />
          <div className="ui-skeleton h-10 w-full rounded-lg" />
          <div className="ui-skeleton h-32 rounded-xl" />
        </LoadingCard>
      </div>
    </>
  );
}
