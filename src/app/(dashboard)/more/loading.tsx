import { LoadingCard } from "@/components/ui/segment-loading";

export default function MoreToolsIndexLoading() {
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        Loading tools index. Search, shortcuts, and grouped destinations will appear shortly.
      </div>
      <div className="ui-page-stack" aria-hidden aria-busy="true">
        <header className="ui-page-header">
          <div className="space-y-3">
            <div className="ui-skeleton h-4 w-24 rounded" />
            <div className="ui-skeleton h-10 w-48 max-w-full rounded" />
            <div className="ui-skeleton h-4 max-w-2xl rounded" />
          </div>
          <div className="mt-4 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="ui-skeleton h-10 w-full flex-1 rounded-lg sm:min-w-[16rem]" />
            <div className="ui-skeleton h-10 w-full rounded-lg sm:w-52" />
            <div className="ui-skeleton h-10 w-24 rounded-lg" />
          </div>
        </header>

        <section className="ui-page-shell p-5">
          <div className="ui-skeleton h-3 w-24 rounded" />
          <div className="ui-skeleton mt-2 h-7 w-40 rounded" />
          <div className="ui-skeleton mt-2 h-3 max-w-3xl rounded" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} className="p-4">
                <div className="ui-skeleton h-4 w-1/2 rounded" />
                <div className="ui-skeleton mt-2 h-3 w-3/4 rounded" />
                <div className="ui-skeleton mt-4 h-8 w-28 rounded" />
              </LoadingCard>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, col) => (
            <section
              key={col}
              className="ui-card overflow-hidden"
            >
              <div className="ui-surface-tint border-b border-[var(--border-subtle)] px-5 py-4">
                <div className="ui-skeleton h-5 w-40 rounded" />
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {Array.from({ length: 4 }).map((_, row) => (
                  <li key={row} className="px-5 py-4">
                    <div className="ui-skeleton h-4 w-3/4 max-w-full rounded" />
                    <div className="ui-skeleton mt-2 h-3 w-full rounded" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
