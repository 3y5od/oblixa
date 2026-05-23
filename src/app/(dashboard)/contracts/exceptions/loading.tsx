export default function ExceptionsLedgerLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading exception ledger. Severity filters and exception rows will appear shortly.
      </div>
      <div className="ui-page-stack mx-auto max-w-6xl" aria-hidden aria-busy="true">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="ui-skeleton h-10 w-10 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <div className="ui-skeleton h-3 w-24 rounded" />
              <div className="ui-skeleton h-8 w-72 rounded" />
              <div className="ui-skeleton h-3 w-96 max-w-full rounded" />
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="ui-skeleton h-24 rounded-2xl" />
          <div className="ui-skeleton h-24 rounded-2xl" />
          <div className="ui-skeleton h-24 rounded-2xl" />
          <div className="ui-skeleton h-24 rounded-2xl" />
        </div>
        <div className="ui-skeleton h-44 rounded-2xl" />
        <div className="ui-skeleton h-72 rounded-2xl" />
      </div>
    </>
  );
}
