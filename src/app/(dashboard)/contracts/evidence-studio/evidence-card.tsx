import type { ReactNode } from "react";
import Link from "next/link";
import { EvidenceReleaseActions } from "@/components/evidence/evidence-release-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { EVIDENCE_ROW_LABELS } from "@/lib/evidence/spec-strings";
import type { EvidenceRow } from "@/lib/evidence/types";
import { dueDescriptor, EvidenceFileState, StatusIcon } from "./evidence-row-parts";

export function EvidenceCard({ row, mutationsEnabled }: { row: EvidenceRow; mutationsEnabled: boolean }) {
  const dueTone = row.status === "overdue" ? "danger" : row.dueState === "due_soon" ? "warning" : "neutral";
  const descriptor = dueDescriptor(row.dueInDays, row.status);
  const titleHref = row.display.requestTitle.href ?? row.href;
  const unassigned = row.requestOwnerLabel === "Unassigned";
  return (
    <li
      className="px-5 py-4"
      style={row.status === "overdue" ? { boxShadow: "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 60%, transparent)" } : undefined}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={titleHref} className="block truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]">
            {row.requestTitle}
          </Link>
          <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-tertiary)]">
            {row.contractTitle}
          </span>
        </div>
        <StatusBadge status={row.statusTone} className="shrink-0 gap-1.5">
          <StatusIcon status={row.status} />
          {row.statusLabel}
        </StatusBadge>
      </div>

      <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2.5">
        <CardMeta label={EVIDENCE_ROW_LABELS.requestOwner}>
          <span className={unassigned ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}>
            {row.requestOwnerLabel}
          </span>
        </CardMeta>
        <CardMeta label={EVIDENCE_ROW_LABELS.dueDate}>
          {row.dueAt ? (
            <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
              <TimeChip date={row.dueAt} format="calendar" tone={dueTone} />
              {descriptor ? <span className="text-[11px] text-[var(--text-tertiary)]">{descriptor}</span> : null}
            </span>
          ) : (
            <span className="text-[var(--text-tertiary)]">{"\u2014"}</span>
          )}
        </CardMeta>
        <CardMeta label={EVIDENCE_ROW_LABELS.linkedObligation}>
          {row.linkedObligationId ? (
            row.linkedObligationHref ? (
              <Link href={row.linkedObligationHref} className="text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]">
                {row.linkedObligationTitle}
              </Link>
            ) : (
              <span className="text-[var(--text-secondary)]">{row.linkedObligationTitle}</span>
            )
          ) : (
            <span className="text-[var(--text-tertiary)]">{"\u2014"}</span>
          )}
        </CardMeta>
        <CardMeta label={row.requiresFile ? EVIDENCE_ROW_LABELS.attachedFiles : "Evidence"}>
          <EvidenceFileState row={row} />
        </CardMeta>
      </dl>

      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px]" suppressHydrationWarning>
          <span className="ui-caps-3 text-[var(--text-tertiary)]">Updated</span>
          {row.lastUpdateAt ? <TimeChip date={row.lastUpdateAt} /> : <span className="text-[var(--text-tertiary)]">{"\u2014"}</span>}
        </span>
        <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
      </div>
    </li>
  );
}

function CardMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="ui-caps-3 text-[var(--text-tertiary)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[12px]">{children}</dd>
    </div>
  );
}
