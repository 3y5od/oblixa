import type { ReactNode } from "react";
import { StatCell, type StatTone } from "@/components/ui/stat-cell";

export interface StatStripCell {
  label: string;
  display: string;
  isZero: boolean;
  tone: StatTone;
  context: ReactNode;
}

export interface StatStripProps {
  cells: ReadonlyArray<StatStripCell>;
  ariaLabel: string;
}

export function StatStrip({ cells, ariaLabel }: StatStripProps) {
  return (
    <section
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={ariaLabel}
    >
      {cells.map((cell) => (
        <StatCell
          key={cell.label}
          label={cell.label}
          display={cell.display}
          isZero={cell.isZero}
          tone={cell.tone}
          context={cell.context}
        />
      ))}
    </section>
  );
}
