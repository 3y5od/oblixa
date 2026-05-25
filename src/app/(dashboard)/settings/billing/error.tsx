"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { UiAlert } from "@/components/ui/ui-alert";
import { captureClientException } from "@/lib/observability/sentry-client";

// SPEC: docs/billing-page-maximal-pass.md §15.1 + refinement-pass §1.14
// billing-scoped error boundary with variant copy per error class.

type ErrorVariant = "stripe" | "supabase" | "network" | "default";

function classifyError(error: Error & { digest?: string; cause?: unknown }): {
  variant: ErrorVariant;
  title: string;
  body: string;
} {
  const { message: msg = "", name = "" } = error;
  if (
    name === "StripeAPIError" ||
    name.startsWith("Stripe") ||
    "requestId" in error ||
    /stripe/i.test(msg)
  ) {
    return {
      variant: "stripe",
      title: "Stripe had a hiccup",
      body:
        "We couldn't reach Stripe to load your subscription details. This is usually transient — retrying clears it.",
    };
  }
  if (
    /PGRST/i.test(msg) ||
    /postgres/i.test(msg) ||
    /supabase/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /column .* does not exist/i.test(msg)
  ) {
    return {
      variant: "supabase",
      title: "Database hiccup",
      body:
        "We couldn't reach the database to load your workspace billing record. Refresh in a moment.",
    };
  }
  if (
    /fetch failed/i.test(msg) ||
    /network/i.test(msg) ||
    /ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(msg) ||
    name === "TypeError"
  ) {
    return {
      variant: "network",
      title: "Connection dropped",
      body:
        "The network connection dropped while loading billing. Check your connection and retry.",
    };
  }
  return {
    variant: "default",
    title: "We couldn't load billing",
    body: "Something went wrong loading your subscription details. This is usually a transient issue.",
  };
}

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[settings/billing] error boundary:", error);
    captureClientException(error, {
      extra: { route: "settings/billing/error", digest: error.digest },
    });
  }, [error]);

  const { title, body } = classifyError(error);

  return (
    <div className="ui-page-stack mx-auto max-w-4xl gap-4">
      <Link
        href="/settings"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px]"
      >
        Back to settings
      </Link>
      <UiAlert
        tone="warning"
        title={title}
        icon={
          <AlertTriangle
            className="h-4 w-4"
            strokeWidth={1.85}
            aria-hidden
          />
        }
      >
        <div className="space-y-3">
          <p>{body}</p>
          {error.digest ? (
            <p className="ui-caps-3 font-mono text-[var(--text-tertiary)]">
              REF {error.digest}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="ui-btn-primary rounded-full px-4 py-2 text-[13px]"
            >
              Try again
            </button>
            <Link
              href="mailto:support@oblixa.com"
              className="ui-btn-ghost rounded-full px-4 py-2 text-[13px]"
            >
              Contact support
            </Link>
          </div>
        </div>
      </UiAlert>
    </div>
  );
}
