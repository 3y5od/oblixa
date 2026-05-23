"use client";

import { usePathname } from "next/navigation";

/**
 * Top-of-page progress bar that briefly slides in on route changes, then fades out.
 * Mount once at the dashboard layout root. CSS-only animation; no third-party deps.
 */
export function UiRouteProgress() {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-[var(--z-toast,60)] h-[2px] origin-left animate-[ui-route-progress_450ms_ease-out_forwards] bg-gradient-to-r from-transparent via-[var(--accent-strong)] to-transparent"
    />
  );
}
