"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
import { captureClientException } from "@/lib/observability/sentry-client";

export default function OperatorAccessRequestsError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
    captureClientException(error, {
      extra: { route: "app/operator/access-requests", digest: error.digest },
    });
  }, [error]);

  return (
    <RouteStatePanel
      eyebrow="Internal operator"
      title="Access requests are unavailable"
      copy="This operator surface could not load safely. Check operator authorization, access-review tables, and provider availability before retrying."
      digest={error.digest}
      icon={<ShieldAlert className="h-5 w-5" strokeWidth={1.65} />}
      shellClassName="bg-canvas min-h-screen py-10"
      actions={
        <Link href="/login" className="ui-btn-secondary px-4 py-2 text-sm">
          Back to sign in
        </Link>
      }
    />
  );
}
