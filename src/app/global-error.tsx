"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-dvh items-center justify-center bg-canvas p-6 font-sans text-[var(--text-secondary)] antialiased">
        <div className="ui-card w-full max-w-md px-7 py-8 text-center shadow-[var(--shadow-2)]">
          <p className="ui-kicker text-zinc-500">Oblixa</p>
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900">Something went wrong</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            Please refresh the page. If the problem continues, contact support with the reference below.
          </p>
          {error.digest ? (
            <p className="ui-density-note mt-3 text-zinc-500">Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ui-btn-primary mt-6 w-full min-w-[8rem] sm:w-auto"
          >
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
