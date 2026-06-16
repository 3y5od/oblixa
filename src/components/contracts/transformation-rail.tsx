import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export interface TransformationNode {
  /** A quiet line icon for the node. */
  icon: ReactNode;
  /** Sentence-case node label (e.g. "Signed document"). */
  label: string;
  /** Short line under the label so the meaning is visible, not hidden in aria. */
  caption: string;
}

export interface TransformationRailProps {
  /** Optional sentence-case label above the rail (a quiet group label). */
  eyebrow?: string;
  nodes: TransformationNode[];
  className?: string;
}

/**
 * The source-to-record diagram (§9). Nodes flow left-to-right on wide screens,
 * connected by thin arrow glyphs, and stack vertically with downward connectors
 * on narrow widths. Each node shows a quiet icon, a sentence-case label, and a
 * short visible caption. The rail also exposes an aria-label summarizing the
 * flow for screen-reader parity. A ruled strip, not a card grid — quiet,
 * document-diagram feel.
 */
export function TransformationRail({
  eyebrow,
  nodes,
  className,
}: TransformationRailProps) {
  const flowSummary = nodes.map((n) => n.label).join(", then ");
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="mb-2 text-[11.5px] font-medium leading-none text-[var(--text-secondary)]">
          {eyebrow}
        </p>
      ) : null}
      <div
        role="group"
        aria-label={`How a source document becomes a contract record: ${flowSummary}.`}
        className="flex flex-col gap-0 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,var(--surface-raised))] p-4 sm:flex-row sm:items-stretch"
      >
        {nodes.map((node, index) => (
          <div key={node.label} className="contents">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:flex-col sm:items-start sm:gap-2">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
              >
                {node.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold leading-snug text-[var(--text-primary)]">
                  {node.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
                  {node.caption}
                </p>
              </div>
            </div>
            {index < nodes.length - 1 ? (
              <span
                aria-hidden
                className="flex shrink-0 items-center justify-center self-stretch py-1 text-[var(--text-tertiary)] sm:px-3 sm:py-0"
              >
                <ArrowRight className="hidden h-4 w-4 sm:block" strokeWidth={1.5} />
                <ArrowRight className="h-4 w-4 rotate-90 sm:hidden" strokeWidth={1.5} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
