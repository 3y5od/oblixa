"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function MarketingError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-canvas px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-600">
        This page could not be loaded. You can try again or return to the home page.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="ui-btn-primary px-4 py-2 text-sm">
          Try again
        </button>
        <Link href="/" className="ui-btn-secondary px-4 py-2 text-sm">
          Home
        </Link>
      </div>
    </div>
  );
}
