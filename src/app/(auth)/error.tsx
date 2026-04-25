"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
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
    <RouteStatePanel
      eyebrow="Sign-in"
      title="Something went wrong"
      copy="Try again, or return to the sign-in page if the problem continues."
      digest={error.digest}
      icon={<AlertCircle className="h-6 w-6" strokeWidth={1.75} />}
      shellClassName="bg-canvas"
      actions={
        <>
          <button type="button" onClick={() => unstable_retry()} className="ui-btn-primary px-4 py-2 text-sm">
            Try again
          </button>
          <Link href="/login" className="ui-btn-secondary px-4 py-2 text-sm">
            Back to sign in
          </Link>
        </>
      }
    />
  );
}
