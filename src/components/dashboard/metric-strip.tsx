import type { ReactNode } from "react";
import { surfaceTestIds } from "@/lib/qa/test-ids";

/**
 * Workspace snapshot — the six release-state top cards (review, dates, blocked
 * work, missing owners, problems, evidence) as a set of crafted, self-contained
 * cards (not a connected table grid): an icon+count cluster, the object title and
 * its consequence, a quiet action indicator, and a status-colored rail. Separated
 * by spacing so the set reads as designed records, not spreadsheet cells. Spans
 * the full content width above the work/context split.
 */
export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Workspace snapshot" data-testid={surfaceTestIds.dashboardStats} className="min-w-0">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
