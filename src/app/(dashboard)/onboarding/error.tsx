"use client";

import Link from "next/link";

export default function OnboardingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ui-page-stack mx-auto max-w-lg px-4">
      <div className="ui-card bg-surface p-6">
        <h1 className="text-lg font-semibold text-zinc-900">Something went wrong</h1>
        <p className="ui-muted-tight mt-2 text-sm text-zinc-600">
          We could not load onboarding. You can retry or return to the dashboard.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="ui-btn-secondary px-4 py-2 text-sm" onClick={reset}>
            Try again
          </button>
          <Link href="/dashboard" className="ui-btn-primary px-4 py-2 text-sm">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
