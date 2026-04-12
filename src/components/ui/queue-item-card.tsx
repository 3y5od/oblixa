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
      className={`rounded-2xl border border-[var(--border-subtle)] p-3 shadow-[var(--shadow-1)] ${OPERATIONAL_SHELL_BY_TONE[opTone]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100/90 text-zinc-700 ring-1 ring-zinc-200/80`}
          >
            <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{objectType}</p>
            <h3 className="mt-0.5 text-sm font-semibold tracking-tight text-zinc-900">
              {href ? (
                <Link href={href} className="text-[var(--accent)] hover:text-zinc-900">
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
                className="mt-1 text-[10px] leading-snug text-zinc-500"
              />
            ) : null}
          </div>
        </div>
        <StatusBadge status={statusTone} className="shrink-0">
          {statusLabel}
        </StatusBadge>
      </div>

      <div className="mt-2 flex flex-wrap gap-2" role="list">
        {chips.map((c) => (
          <OperationalMetricChip key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-2 border-t border-zinc-200/60 pt-2 dark:border-zinc-700/50">
        <Link href={nextAction.href} className="text-[12px] font-semibold text-[var(--accent)] hover:text-zinc-900">
          {nextAction.label}
        </Link>
      </div>
    </article>
  );
}
