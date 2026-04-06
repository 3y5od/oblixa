"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-6 font-sans text-zinc-900 antialiased">
        <h1 className="text-lg font-bold tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-center text-sm text-zinc-600">
          An unexpected error occurred. You can try again or return to the dashboard.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="ui-btn-primary"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
