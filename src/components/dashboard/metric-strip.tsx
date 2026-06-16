import type { ReactNode } from "react";

/**
 * Workspace snapshot: one bordered ledger surface, not a wall of floating KPI
 * cards. A quiet header band states the surface and its scope; the six signals
 * sit in a divided grid where 1px gaps over a hairline ground read as ledger
 * rules between cells (§Tables/Ledger, §Composition — rules over boxes). The
 * dashboard's single raised focal surface (§Panels: one raised surface).
 */
export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Workspace snapshot" className="ui-card-raised overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] px-4 py-2.5">
        <h2 className="ui-caps-2 text-[11px] text-[var(--text-secondary)]">Workspace snapshot</h2>
        <p className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">
          Active contracts and open items in this workspace
        </p>
      </div>
      {/* gap-px over a hairline ground draws clean interior rules between the six
          cells; each cell paints its own surface so only the gaps show through. */}
      <div className="grid grid-cols-1 gap-px bg-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
