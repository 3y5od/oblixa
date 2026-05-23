import { InlineSkeleton } from "@/components/ui/inline-skeleton";

export interface UiTableSkeletonProps {
  rows?: number;
  columns?: number;
  /** Optional widths per column. Defaults stagger between w-32 and w-24. */
  columnWidths?: ReadonlyArray<string>;
  className?: string;
}

const DEFAULT_WIDTHS = ["w-44", "w-32", "w-24", "w-32", "w-20", "w-28", "w-24"];

export function UiTableSkeleton({
  rows = 5,
  columns = 5,
  columnWidths,
  className,
}: UiTableSkeletonProps) {
  const widths = columnWidths ?? DEFAULT_WIDTHS;
  return (
    <div
      role="presentation"
      aria-busy="true"
      className={`divide-y divide-[var(--border-card)] ${className ?? ""}`}
    >
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="grid items-center gap-3 px-5 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <InlineSkeleton key={colIdx} widthClass={widths[colIdx % widths.length]} heightClass="h-3" />
          ))}
        </div>
      ))}
    </div>
  );
}
