export default function BulkImportLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading bulk import. Upload form and job history will appear shortly.
      </div>
      <div className="mx-auto w-full max-w-6xl" aria-hidden aria-busy="true">
        <div className="flex flex-col gap-2.5">
          <div className="ui-skeleton h-7 w-32 rounded-full" />
          <div className="flex items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="ui-skeleton h-3 w-28 rounded" />
              <div className="ui-skeleton h-8 w-56 max-w-full rounded" />
              <div className="ui-skeleton h-4 w-80 max-w-full rounded" />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="ui-card-raised rounded-2xl p-5">
            <div className="ui-skeleton h-9 w-full rounded-lg" />
            <div className="mt-4 ui-skeleton h-32 w-full rounded-xl" />
            <div className="mt-4 ui-skeleton h-10 w-40 rounded-lg" />
          </div>
          <div className="ui-card-quiet rounded-2xl p-4">
            <div className="ui-skeleton h-4 w-28 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mt-3 ui-skeleton h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
