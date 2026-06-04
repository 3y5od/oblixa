export default function OperatorAccessRequestsLoading() {
  return (
    <main className="min-h-screen bg-[var(--canvas)] px-6 py-8" aria-busy="true">
      <div className="mx-auto max-w-6xl">
        <div className="sr-only" role="status" aria-live="polite">
          Loading access requests
        </div>
        <div className="h-7 w-44 rounded-full bg-[var(--surface-muted)]" />
        <div className="mt-3 h-10 w-72 rounded-lg bg-[var(--surface-muted)]" />
        <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <div className="grid grid-cols-4 gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-3 rounded bg-[var(--border-subtle)]" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid grid-cols-4 gap-4 border-b border-[var(--border-subtle)] px-4 py-4 last:border-b-0">
              <div className="space-y-2">
                <div className="h-4 rounded bg-[var(--surface-muted)]" />
                <div className="h-3 w-3/4 rounded bg-[var(--surface-muted)]" />
              </div>
              <div className="space-y-2">
                <div className="h-3 rounded bg-[var(--surface-muted)]" />
                <div className="h-3 w-2/3 rounded bg-[var(--surface-muted)]" />
              </div>
              <div className="h-5 w-24 rounded-full bg-[var(--surface-muted)]" />
              <div className="h-16 rounded-xl bg-[var(--surface-muted)]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
