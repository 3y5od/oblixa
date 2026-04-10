import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16">
      <div className="ui-card w-full max-w-md rounded-2xl border border-[var(--border-subtle)] px-8 py-10 text-center shadow-[var(--shadow-1)]">
        <p className="text-4xl font-bold tabular-nums text-zinc-200 sm:text-5xl">404</p>
        <p className="ui-eyebrow mt-4">Not found</p>
        <h1 className="ui-section-title mt-2 text-xl">Page not found</h1>
        <p className="ui-muted-tight mt-2 text-[13px]">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/dashboard" className="ui-btn-primary mt-8 inline-block px-5 py-2.5 text-[13px]">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
