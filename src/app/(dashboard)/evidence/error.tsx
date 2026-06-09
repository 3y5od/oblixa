"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
import { captureClientException } from "@/lib/observability/sentry-client";

export default function EvidenceError({
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
      extra: { route: "app/(dashboard)/evidence", digest: error.digest },
    });
  }, [error]);

  return (
    <RouteStatePanel
      eyebrow="Evidence"
      title="Evidence did not load"
      copy="Something went wrong loading evidence requests. Your filters are kept in the address bar; try again to reload this view."
      digest={error.digest}
      icon={<AlertTriangle className="h-6 w-6" strokeWidth={1.65} />}
      actions={
        <>
          <button type="button" onClick={() => unstable_retry()} className="ui-btn-primary px-5 py-2.5">
            Try again
          </button>
          <Link href="/dashboard" className="ui-btn-secondary px-5 py-2.5">
            Back to dashboard
          </Link>
        </>
      }
    />
  );
}
