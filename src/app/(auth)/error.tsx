"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { captureClientException } from "@/lib/observability/sentry";

export default function AuthError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
    captureClientException(error, {
      extra: { route: "auth/error", digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
      <div className="ui-card mx-auto max-w-md rounded-2xl border border-[var(--border-subtle)] px-6 py-8 text-center shadow-[var(--shadow-1)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200/80 bg-red-50">
          <AlertCircle className="h-6 w-6 text-red-700" strokeWidth={1.75} aria-hidden />
        </div>
        <p className="ui-eyebrow mt-5">Sign-in</p>
        <h2 className="ui-section-title mt-2 text-xl">Something went wrong</h2>
        <p className="ui-muted-tight mt-2 text-[13px]" role="status">
          Try again, or return to the sign-in page if the problem continues.
        </p>
        {error.digest ? (
          <p className="mt-1 text-xs text-zinc-400">Error ID: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => unstable_retry()} className="ui-btn-primary px-5 py-2.5">
            Try again
          </button>
          <Link href="/login" className="ui-btn-secondary px-5 py-2.5">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
