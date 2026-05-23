import Link from "next/link";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import {
  ContractContinuityLinks,
  type ContinuityPage,
} from "@/components/ui/contract-continuity-links";
import {
  OperationalMetricChip,
  semanticStatusToOperationalTone,
} from "@/components/ui/operational-summary-card";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import { OPERATIONAL_SHELL_BY_TONE } from "@/lib/ui/operational-surface";

export function QueueItemCard({
  title,
  href,
  objectType,
  statusLabel,
  statusTone,
  owner,
  due,
  nextAction,
  meta,
  continuityContractId,
  continuityOmit,
  continuityLabel,
  actions,
}: {
  title: string;
  href?: string;
  objectType: string;
  statusLabel: string;
  statusTone: SemanticStatus;
  owner?: string;
  due?: string;
  nextAction: { label: string; href: string };
  meta?: string;
  /** When set, shows cross-surface links for this contract (refinement §16.3). */
  continuityContractId?: string;
  continuityOmit?: ContinuityPage[];
  continuityLabel?: string;
  actions?: ReactNode;
}) {
  const opTone = semanticStatusToOperationalTone(statusTone);
  const chips: { label: string; value: string }[] = [
    { label: "Owner", value: owner ?? "Unassigned" },
    ...(due ? [{ label: "Due", value: due } as const] : []),
    ...(meta ? [{ label: "Note", value: meta } as const] : []),
  ];

  return (
    <article
      className={`ui-operational-card p-4 ${OPERATIONAL_SHELL_BY_TONE[opTone]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="ui-icon-tile-compact h-10 w-10 shrink-0 text-[var(--text-secondary)]">
            <FileText className="h-4 w-4" strokeWidth={1.65} aria-hidden />
          </span>
          <div className="min-w-0 pr-1">
            <p className="ui-kicker">{objectType}</p>
            <h3 className="mt-1.5 break-words text-[14px] font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
              {href ? (
                <Link
                  href={href}
                  className="ui-operational-focusable break-words rounded-sm text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
                >
                  {title}
                </Link>
              ) : (
                title
              )}
            </h3>
            {continuityContractId ? (
              <ContractContinuityLinks
                contractId={continuityContractId}
                omit={continuityOmit}
                label={continuityLabel}
                className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]"
              />
            ) : null}
          </div>
        </div>
        <StatusBadge status={statusTone} className="shrink-0 whitespace-nowrap">
          {statusLabel}
        </StatusBadge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="list">
        {chips.map((c) => (
          <OperationalMetricChip key={c.label} {...c} />
        ))}
      </div>

      {actions}

      <div className="mt-3.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] pt-3">
        <Link
          href={nextAction.href}
          className="ui-operational-action"
          aria-label={`${nextAction.label} for ${title}`}
        >
          <span className="truncate">{nextAction.label}</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
