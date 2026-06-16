import type { ReactNode } from "react";

export interface ImportSchemaRow {
  /** Sentence-case human name of the column (e.g. "Contract name"). */
  label: string;
  /** The exact CSV header, shown in mono snake_case (e.g. "title"). */
  header: string;
  /** Whether the importer requires this column. */
  required: boolean;
  /** What the value becomes once imported (e.g. "Contract record title"). */
  becomes: string;
}

export interface ImportSchemaTableProps {
  title: string;
  rows: ImportSchemaRow[];
  /** Right-aligned slot in the header band — typically a template download. */
  templateAction?: ReactNode;
  className?: string;
}

/**
 * The CSV column ledger (§8 product artifact). A quiet header band carries the
 * title and an optional template action; below it a stable table maps each human
 * column to its exact CSV header, whether it is required, and what the value
 * becomes in Oblixa. CSV headers render in mono snake_case; required/optional is
 * quiet sentence-case text, not a caps pill. Thin rules, low radius, readable at
 * displayed size, and accessible via real <th scope> relationships.
 */
export function ImportSchemaTable({
  title,
  rows,
  templateAction,
  className,
}: ImportSchemaTableProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] ${className ?? ""}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_60%,var(--surface-raised))] px-4 py-2.5">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
        {templateAction ? <div className="shrink-0">{templateAction}</div> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th
                scope="col"
                className="px-4 py-2 text-[11px] font-medium text-[var(--text-tertiary)]"
              >
                Column
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-[11px] font-medium text-[var(--text-tertiary)]"
              >
                CSV header
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-[11px] font-medium text-[var(--text-tertiary)]"
              >
                Required
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-[11px] font-medium text-[var(--text-tertiary)]"
              >
                Becomes in Oblixa
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.header}
                className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] last:border-b-0"
              >
                <th
                  scope="row"
                  className="px-4 py-2.5 text-[12.5px] font-medium text-[var(--text-primary)]"
                >
                  {row.label}
                </th>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-[11.5px] text-[var(--text-secondary)]">
                    {row.header}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[12px] text-[var(--text-secondary)]">
                  {row.required ? "Required" : "Optional"}
                </td>
                <td className="px-4 py-2.5 text-[12px] leading-snug text-[var(--text-secondary)]">
                  {row.becomes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
