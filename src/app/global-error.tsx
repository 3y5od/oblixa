"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./globals.css";
import { AlertOctagon } from "lucide-react";
import { RouteStatePanel } from "@/components/ui/route-state-panel";
import { captureClientException } from "@/lib/observability/sentry-client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureClientException(error, { extra: { route: "global-error", digest: error.digest } });
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="landing-root min-h-dvh bg-canvas font-sans text-[var(--text-secondary)] antialiased">
        <div aria-hidden className="landing-header-backdrop" />
        <main className="landing-luminous relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
          <div aria-hidden className="landing-luminous__base" />
          <div aria-hidden className="landing-luminous__glow" />
          <div aria-hidden className="landing-luminous__grid" />
          <RouteStatePanel
            eyebrow="System notice"
            title="This page could not load"
            copy="We've recorded the issue. Try again now, or return to your workspace. If this keeps happening, our team is already looking into it."
            digest={error.digest}
            digestLabel="Reference"
            icon={<AlertOctagon className="h-6 w-6" strokeWidth={1.65} />}
            cardClassName="ui-hero-shell max-w-xl"
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
        </main>
      </body>
    </html>
  );
}
