"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { UiAlert } from "@/components/ui/ui-alert";
import { captureClientException } from "@/lib/observability/sentry-client";
import {
  COMMAND_PALETTE_OPEN_EVENT,
  type CommandPaletteOpenDetail,
} from "@/lib/product-surface/command-palette-bridge";

/** T15.2 — recoverable error boundary for /search. Mirrors the billing /
 *  security pattern (variant copy + retry). Recovery actions:
 *  - Try again — resets the error boundary
 *  - Open command palette — dispatches the cmd-K event so the user has an
 *    alternate path to navigate
 *  - Back to dashboard — safe escape hatch
 */
export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[search] error boundary:", error);
    captureClientException(error, {
      extra: { route: "/search", digest: error.digest },
    });
  }, [error]);

  const openPalette = () => {
    window.dispatchEvent(
      new CustomEvent<CommandPaletteOpenDetail>(COMMAND_PALETTE_OPEN_EVENT, {
        detail: { query: "" },
      })
    );
  };

  return (
    <div className="ui-page-stack mx-auto max-w-4xl gap-4">
      <UiAlert
        tone="warning"
        title="We couldn't load search"
        icon={<AlertTriangle className="h-4 w-4" strokeWidth={1.85} aria-hidden />}
      >
        <div className="space-y-3">
          <p>
            Something went wrong loading the workspace search index. Retrying
            usually clears it.
          </p>
          {error.digest ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
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
            <button
              type="button"
              onClick={openPalette}
              className="ui-btn-secondary rounded-full px-4 py-2 text-[13px]"
            >
              Open command palette
            </button>
            <Link
              href="/dashboard"
              className="ui-btn-ghost rounded-full px-4 py-2 text-[13px]"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </UiAlert>
    </div>
  );
}
