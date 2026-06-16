import { LoadingCard } from "@/components/ui/segment-loading";

export default function SettingsLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading settings
      </div>
      {/* Mirrors the SettingsWorkbench frame (rail + header + records) so the
          page does not jump from a centered column to the rail layout on load. */}
      <div className="mx-auto w-full max-w-[1200px]" aria-hidden aria-busy="true">
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="space-y-2">
              <div className="ui-skeleton h-4 w-20 rounded" />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-7 w-full rounded" />
              ))}
            </div>
          </aside>
          <div className="ui-page-stack min-w-0 gap-5">
            <div className="space-y-3">
              <div className="ui-skeleton h-4 w-24 rounded" />
              <div className="ui-skeleton h-9 w-48 rounded" />
              <div className="ui-skeleton h-4 max-w-xl rounded" />
            </div>
            <div className="ui-skeleton h-16 w-full rounded-xl" />
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
        </div>
      </div>
    </>
  );
}
