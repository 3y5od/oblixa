"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
import { captureClientException } from "@/lib/observability/sentry";

export default function OnboardingError({
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
      extra: { route: "dashboard/onboarding/error", digest: error.digest },
    });
  }, [error]);

  return (
    <RouteStatePanel
      eyebrow="Onboarding"
      title="Onboarding could not load"
      copy="Try again now. If the problem keeps happening, return to the dashboard and reopen onboarding from there."
      digest={error.digest}
      icon={<AlertCircle className="h-6 w-6" strokeWidth={1.75} />}
      cardClassName="ui-card"
      actions={
        <>
          <button type="button" className="ui-btn-secondary px-4 py-2 text-sm" onClick={reset}>
            Try again
          </button>
          <Link href="/dashboard" className="ui-btn-primary px-4 py-2 text-sm">
            Dashboard
          </Link>
        </>
      }
    />
  );
}
