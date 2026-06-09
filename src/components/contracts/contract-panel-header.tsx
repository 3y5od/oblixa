import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CountChip } from "@/components/ui/count-chip";
import { ChipPair } from "@/components/ui/chip-pair";

/**
 * Shared section header for the Core contract-detail panels (Review, Dates,
 * Work, Approvals, Obligations, Evidence, Files, Notes, Activity, Owner).
 * Icon tile + eyebrow + title on the left, an optional count chip beside the
 * title, and an optional action cluster on the right. Section title literals
 * are passed by the route so the page keeps ownership of its pinned copy.
 */
export function ContractPanelHeader({
  icon: Icon,
  eyebrow,
  title,
  count,
  countLabel,
  countNode,
  action,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  count?: number;
  /** Noun rendered after the count (e.g. "files", "pending"). When present the
   *  count renders as a weight-graded ChipPair ("3 FILES"); otherwise a bare
   *  CountChip. */
  countLabel?: string;
  /** Custom chip rendered in place of the default count chip (e.g. a RatioChip). */
  countNode?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="ui-icon-tile-compact shrink-0" aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <div className="min-w-0">
          <p className="ui-caps-3 text-[var(--text-tertiary)]">{eyebrow}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="ui-text-compact-wrap text-[1.05rem] font-semibold leading-none tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
            {countNode != null ? (
              countNode
            ) : count != null ? (
              countLabel ? (
                <ChipPair primary={String(count)} secondary={countLabel} />
              ) : (
                <CountChip value={count} emphasis="subtle" />
              )
            ) : null}
          </div>
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}
