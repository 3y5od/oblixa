import Link from "next/link";
import { FileText } from "lucide-react";
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
}) {
  const opTone = semanticStatusToOperationalTone(statusTone);
  const chips: { label: string; value: string }[] = [
    { label: "Owner", value: owner ?? "Unassigned" },
    ...(due ? [{ label: "Due", value: due } as const] : []),
    ...(meta ? [{ label: "Note", value: meta } as const] : []),
  ];

  return (
    <article
      className={`ui-transition-surface rounded-[1.35rem] border border-[var(--border-subtle)] p-3.5 shadow-[var(--shadow-1)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] ${OPERATIONAL_SHELL_BY_TONE[opTone]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-[color:color-mix(in_oklab,var(--surface-contrast)_78%,white)] text-[var(--text-secondary)] ring-1 ring-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]"
          >
            <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 pr-1">
            <p className="ui-kicker">{objectType}</p>
            <h3 className="mt-1 break-words text-sm font-semibold tracking-tight leading-snug text-[var(--text-primary)]">
              {href ? (
                <Link href={href} className="break-words text-[var(--accent-strong)] hover:text-[var(--text-primary)]">
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
                className="mt-1 text-[10px] leading-snug text-[var(--text-tertiary)]"
              />
            ) : null}
          </div>
        </div>
        <StatusBadge status={statusTone} className="shrink-0 whitespace-nowrap">
          {statusLabel}
        </StatusBadge>
      </div>

      <div className="mt-2 flex flex-wrap gap-2" role="list">
        {chips.map((c) => (
          <OperationalMetricChip key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] pt-2.5">
        <Link
          href={nextAction.href}
          className="inline-flex min-w-0 max-w-full items-center gap-1 text-[12px] font-semibold text-[var(--accent-strong)] hover:text-[var(--text-primary)]"
        >
          <span className="truncate">{nextAction.label}</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
