"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
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
    <RouteStatePanel
      eyebrow="External workflow"
      title="This page hit an error"
      copy="Use the link from your email again, or contact the sender if this keeps happening."
      digest={error.digest}
      icon={<AlertCircle className="h-5 w-5" strokeWidth={1.75} />}
      shellClassName="bg-canvas min-h-[40vh] py-10"
      actions={
        <>
          <button type="button" onClick={() => unstable_retry()} className="ui-btn-primary px-4 py-2 text-sm">
            Try again
          </button>
          <Link href="/" className="ui-btn-secondary px-4 py-2 text-sm">
            Oblixa home
          </Link>
        </>
      }
    />
  );
}
