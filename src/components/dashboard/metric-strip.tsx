import type { ReactNode } from "react";

/**
 * Dashboard summary surface: six top signals with enough room for a short
 * definition. The 3-column desktop grid avoids forcing operational concepts
 * into one cramped label row.
 */
export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Dashboard summary" className="ui-card-raised overflow-hidden">
      <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
