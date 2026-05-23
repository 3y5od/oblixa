import type { ReactNode } from "react";

export interface UiDefinitionRow {
  label: string;
  value: ReactNode;
}

export interface UiDefinitionListProps {
  rows: ReadonlyArray<UiDefinitionRow>;
  variant?: "default" | "compact";
  monoValues?: boolean;
  className?: string;
}

export function UiDefinitionList({
  rows,
  variant = "default",
  monoValues = false,
  className,
}: UiDefinitionListProps) {
  const rowPadding = variant === "compact" ? "py-1.5" : "py-2";
  return (
    <dl
      className={`divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] ${className ?? ""}`}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className={`flex items-center justify-between gap-3 ${rowPadding}`}
        >
          <dt className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            {row.label}
          </dt>
          <dd
            className={`text-[12.5px] text-[var(--text-primary)] ${
              monoValues ? "font-mono tabular-nums" : ""
            }`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
