"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
import { captureClientException } from "@/lib/observability/sentry";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
    captureClientException(error, {
      extra: { route: "marketing/error", digest: error.digest },
    });
  }, [error]);

  return (
    <RouteStatePanel
      title="This page could not load"
      copy="Try again now. If the problem keeps happening, return to the home page before reopening this page."
      icon={<AlertCircle className="h-6 w-6" strokeWidth={1.75} />}
      shellClassName="bg-canvas"
      actions={
        <>
          <button type="button" onClick={reset} className="ui-btn-primary px-4 py-2 text-sm">
            Try again
          </button>
          <Link href="/" className="ui-btn-secondary px-4 py-2 text-sm">
            Home
          </Link>
        </>
      }
    />
  );
}
