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
      <body className="flex min-h-dvh items-center justify-center p-6 font-sans text-[var(--text-secondary)] antialiased">
        <div className="ui-card-hero w-full max-w-xl px-8 py-10 text-center shadow-[var(--shadow-3)]">
          <p className="ui-kicker">Oblixa</p>
          <h1 className="mt-3 text-[1.6rem] font-semibold tracking-tight text-[var(--text-primary)]">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            Please refresh the page. If the problem continues, contact support with the reference below.
          </p>
          {error.digest ? (
            <p className="ui-density-note mt-3">Reference: {error.digest}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ui-btn-primary min-w-[8rem]"
            >
              Refresh
            </button>
            <a href="/dashboard" className="ui-btn-secondary min-w-[8rem]">
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
