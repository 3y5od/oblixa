"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
import { captureClientException } from "@/lib/observability/sentry-client";

export default function RootError({
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
      extra: { route: "app/error", digest: error.digest },
    });
  }, [error]);

  return (
    <RouteStatePanel
      eyebrow="System notice"
      title="This page could not load"
      copy="Try again now. If the problem keeps happening, return to the dashboard or home page before reopening this workflow."
      digest={error.digest}
      icon={<AlertOctagon className="h-6 w-6" strokeWidth={1.65} />}
      shellClassName="bg-canvas"
      cardClassName="ui-hero-shell max-w-xl"
      actions={
        <>
          <button type="button" onClick={() => unstable_retry()} className="ui-btn-primary px-5 py-2.5">
            Try again
          </button>
          <Link href="/" className="ui-btn-secondary px-5 py-2.5">
            Home
          </Link>
          <Link href="/dashboard" className="ui-link px-2 py-2 text-sm font-semibold">
            Dashboard
          </Link>
        </>
      }
    />
  );
}
