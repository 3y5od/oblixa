// Loading boundary matching the post-redesign workbench shape: a left rail
// skeleton + a header skeleton (no icon tile) + record skeletons for Account
// protection, Sessions and devices, and the security-context ledger.
export default function SecurityLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px]" aria-busy="true">
      <div className="sr-only" role="status" aria-live="polite">
        Loading security settings.
      </div>
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(0,1fr)]">
        {/* Rail skeleton */}
        <aside aria-hidden className="hidden flex-col gap-1.5 lg:flex">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="ui-skeleton h-8 w-full rounded-md" />
          ))}
        </aside>

        <div className="ui-page-stack min-w-0 gap-5">
          {/* Header skeleton */}
          <div className="flex flex-col gap-3">
            <span aria-hidden className="ui-skeleton h-3 w-16 rounded" />
            <span aria-hidden className="ui-skeleton h-7 w-40 rounded" />
            <span aria-hidden className="ui-skeleton h-4 w-80 max-w-full rounded" />
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border-subtle)] pt-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} aria-hidden className="ui-skeleton h-4 w-28 rounded" />
              ))}
            </div>
          </div>

          {/* Account protection card skeleton */}
          <section className="ui-card-raised ui-loading-panel p-0">
            <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-4">
              <span aria-hidden className="ui-skeleton block h-3 w-16 rounded" />
              <span aria-hidden className="ui-skeleton mt-2 block h-5 w-44 rounded" />
            </div>
            <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <span aria-hidden className="ui-skeleton h-4 w-32 rounded" />
                  <span aria-hidden className="ui-skeleton h-16 w-full rounded-lg" />
                  <span aria-hidden className="ui-skeleton h-9 w-40 rounded-full" />
                </div>
              ))}
            </div>
          </section>

          {/* Sessions row-group skeleton */}
          <section className="ui-loading-panel space-y-3">
            <span aria-hidden className="ui-skeleton block h-5 w-44 rounded" />
            <span aria-hidden className="ui-skeleton block h-4 w-3/4 rounded" />
            <span aria-hidden className="ui-skeleton block h-9 w-56 rounded-full" />
          </section>

          {/* Workspace security context ledger skeleton */}
          <section className="ui-loading-panel space-y-2.5">
            <span aria-hidden className="ui-skeleton block h-5 w-48 rounded" />
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} aria-hidden className="ui-skeleton block h-7 w-full rounded" />
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
