"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { captureClientException } from "@/lib/observability/sentry";

export default function ExternalError({
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
      extra: { route: "external/error", digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-10">
      <div className="ui-card mx-auto max-w-md rounded-2xl border border-[var(--border-subtle)] px-6 py-8 text-center shadow-[var(--shadow-1)]">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-red-200/80 bg-red-50">
          <AlertCircle className="h-5 w-5 text-red-700" strokeWidth={1.75} aria-hidden />
        </div>
        <h2 className="ui-section-title mt-4 text-lg">This page hit an error</h2>
        <p className="ui-muted-tight mt-2 text-[13px]" role="status">
          Use the link from your email again, or contact the sender if this keeps happening.
        </p>
        {error.digest ? (
          <p className="mt-1 text-xs text-zinc-400">Error ID: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => unstable_retry()} className="ui-btn-primary px-4 py-2 text-sm">
            Try again
          </button>
          <Link href="/" className="ui-link text-sm font-semibold">
            Oblixa home
          </Link>
        </div>
      </div>
    </div>
  );
}
