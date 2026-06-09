import type { ReactNode } from "react";

/** Decision action zone. On lg it pins to the bottom of the (scrolling) decision
 *  column with an opaque surface + top hairline, so Approve/Edit/Mark unknown/Skip
 *  stay reachable while the value, conflict, and mini-queue scroll above. On
 *  smaller widths it flows in-line at the end of the decision content. */
export function ReviewActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-[var(--border-subtle)] pt-4 lg:sticky lg:bottom-0 lg:z-10 lg:-mx-6 lg:bg-[var(--surface)] lg:px-6 lg:pb-6">
      {children}
    </div>
  );
}
