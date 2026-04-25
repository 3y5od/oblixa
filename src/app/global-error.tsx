"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./globals.css";
import { AlertCircle } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
import { captureClientException } from "@/lib/observability/sentry";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureClientException(error, { extra: { route: "global-error", digest: error.digest } });
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="ui-public-minimal-shell min-h-dvh font-sans text-[var(--text-secondary)] antialiased">
        <RouteStatePanel
          eyebrow="Oblixa"
          title="This page could not load"
          copy="Try again now. If the problem keeps happening, refresh the page, then return to the dashboard or home page while the workflow recovers."
          digest={error.digest}
          digestLabel="Reference"
          icon={<AlertCircle className="h-6 w-6" strokeWidth={1.75} />}
          cardClassName="ui-card-hero max-w-xl shadow-[var(--shadow-3)]"
          actions={
            <>
              <button type="button" onClick={() => window.location.reload()} className="ui-btn-primary min-w-[8rem]">
                Try again
              </button>
              <a href="/dashboard" className="ui-btn-secondary min-w-[8rem]">
                Dashboard
              </a>
              <Link href="/" className="ui-link min-w-[8rem] px-2 py-2 text-sm font-semibold">
                Home
              </Link>
            </>
          }
        />
      </body>
    </html>
  );
}
