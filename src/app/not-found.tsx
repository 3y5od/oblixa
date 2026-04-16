import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="ui-card-hero w-full max-w-2xl px-8 py-12 text-center shadow-[var(--shadow-2)]">
        <p className="text-5xl font-bold tabular-nums text-[color:color-mix(in_oklab,var(--text-tertiary)_38%,transparent)] sm:text-6xl">
          404
        </p>
        <p className="ui-eyebrow mt-5">Route not found</p>
        <h1 className="ui-display-title mt-3 text-[2rem] sm:text-[2.35rem]">This surface does not exist</h1>
        <p className="ui-muted-tight mx-auto mt-3 max-w-lg text-[14px]">
          The page you are looking for may have moved, been gated for your workspace mode, or never existed in
          this environment.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="ui-btn-primary px-5 py-2.5 text-[13px]">
            Go to dashboard
          </Link>
          <Link href="/more" className="ui-btn-secondary px-5 py-2.5 text-[13px]">
            Browse tools
          </Link>
        </div>
      </div>
    </div>
  );
}
