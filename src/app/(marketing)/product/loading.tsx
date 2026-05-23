/**
 * v5 — Loading skeleton for /product mirrors the rebuilt layout:
 * hero + before/after + time-to-value + outcomes strip + anchor nav + 7 cards
 * + closing CTA. All animation pauses under prefers-reduced-motion.
 */
export default function ProductLoading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      aria-label="Loading product page"
      className="landing-luminous relative isolate flex min-h-full flex-1 flex-col overflow-hidden outline-none"
    >
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      <div aria-hidden className="landing-luminous__grid" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        {/* Hero skeleton */}
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="mx-auto h-3 w-24 animate-pulse rounded-full bg-[var(--surface-raised)] motion-reduce:animate-none" />
          <div className="mx-auto h-10 w-full max-w-[18ch] animate-pulse rounded-lg bg-[var(--surface-raised)] motion-reduce:animate-none" />
          <div className="mx-auto h-10 w-full max-w-[16ch] animate-pulse rounded-lg bg-[var(--surface-raised)] motion-reduce:animate-none" />
          <div className="mx-auto h-4 w-full max-w-2xl animate-pulse rounded bg-[var(--surface-raised)] motion-reduce:animate-none" />
          <div className="mx-auto h-4 w-3/4 animate-pulse rounded bg-[var(--surface-raised)] motion-reduce:animate-none" />
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <div className="h-10 w-36 animate-pulse rounded-md bg-[var(--surface-raised)] motion-reduce:animate-none" />
            <div className="h-10 w-32 animate-pulse rounded-md bg-[var(--surface-raised)] motion-reduce:animate-none" />
          </div>
        </div>

        {/* Video placeholder skeleton */}
        <div className="mx-auto mt-10 aspect-[16/9] w-full max-w-2xl animate-pulse rounded-3xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] motion-reduce:animate-none" />

        {/* Before/After skeleton */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] motion-reduce:animate-none"
            />
          ))}
        </div>

        {/* Time-to-value skeleton */}
        <div className="mt-10 h-40 animate-pulse rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] motion-reduce:animate-none" />

        {/* Outcomes strip skeleton */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] motion-reduce:animate-none"
            />
          ))}
        </div>

        {/* Anchor nav skeleton */}
        <div className="mt-6 h-12 animate-pulse rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] motion-reduce:animate-none" />

        {/* Section cards skeleton */}
        <div className="mt-8 space-y-6">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-3xl border-l-4 border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[var(--surface-raised)] motion-reduce:animate-none"
            />
          ))}
        </div>

        {/* Closing CTA skeleton */}
        <div className="mt-16 h-60 animate-pulse rounded-3xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[var(--surface-raised)] motion-reduce:animate-none" />
      </div>
    </main>
  );
}
