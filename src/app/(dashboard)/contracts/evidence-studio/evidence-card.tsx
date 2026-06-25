import type { ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { EvidenceReleaseActions } from "@/components/evidence/evidence-release-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { EVIDENCE_ROW_LABELS } from "@/lib/evidence/spec-strings";
import type { EvidenceRow } from "@/lib/evidence/types";
import {
  consequenceInk,
  dueDescriptor,
  evidenceConsequence,
  EvidenceFileState,
  EvidenceLifecycle,
  fileGapOpen,
  StatusIcon,
} from "./evidence-row-parts";

export function EvidenceCard({ row, mutationsEnabled }: { row: EvidenceRow; mutationsEnabled: boolean }) {
  const atRisk = row.status === "overdue";
  const dueTone = atRisk ? "danger" : row.dueState === "due_soon" ? "warning" : "neutral";
  const descriptor = dueDescriptor(row.dueInDays, row.status);
  const titleHref = row.display.requestTitle.href ?? row.href;
  const unassigned = row.requestOwnerLabel === "Unassigned";
  const consequence = evidenceConsequence(row);
  return (
    <li
      className="px-4 py-4"
      style={
        atRisk
          ? { boxShadow: "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 60%, transparent)" }
          : undefined
      }
    >
      {/* PURPOSE + IDENTITY zone — the parchment source block (mobile parity with
          the desktop record): the requirement leads in a ruled header, then the
          strong request name and contract microtext, then the lifecycle rail. */}
      <div
        className="min-w-0 rounded-md p-3"
        style={{
          background: atRisk
            ? "color-mix(in oklab, var(--danger-soft) 12%, var(--surface-inset))"
            : "color-mix(in oklab, var(--surface-inset) 60%, var(--surface-raised))",
          border: "1px solid color-mix(in oklab, var(--border-strong) 38%, transparent)",
        }}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {row.linkedObligationId ? (
              <p className="mb-1 flex min-w-0 items-center gap-1.5 leading-snug">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
                <span className="ui-caps-3 shrink-0 text-[10px] text-[var(--text-tertiary)]">Proof for</span>
                {row.linkedObligationHref ? (
                  <Link href={row.linkedObligationHref} className="min-w-0 truncate text-[12px] font-semibold text-[var(--text-primary)] underline-offset-2 transition-colors hover:text-[var(--accent-strong)] hover:underline">
                    {row.linkedObligationTitle}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate text-[12px] font-semibold text-[var(--text-primary)]">{row.linkedObligationTitle}</span>
                )}
              </p>
            ) : (
              <p className="mb-1 flex items-center gap-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
                <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.65} aria-hidden />
                <span>Not linked to a requirement</span>
              </p>
            )}
            <Link href={titleHref} className="block truncate text-[15px] font-semibold leading-[1.22] tracking-tight text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]">
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

        {/* PROGRESS zone — the same horizontal lifecycle rail the desktop row
            carries, so mobile shows where proof stands at a glance. */}
        <div className="mt-3">
          <EvidenceLifecycle row={row} />
        </div>
      </div>

      {/* IDENTITY + SCHEDULING strip — owner, due, file state. */}
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
            <span className="text-[var(--text-tertiary)]">{"—"}</span>
          )}
        </CardMeta>
        <CardMeta label={row.requiresFile ? EVIDENCE_ROW_LABELS.attachedFiles : "Evidence"} className="col-span-2">
          <EvidenceFileState row={row} lifecycleCoversFileState={fileGapOpen(row)} />
        </CardMeta>
      </dl>

      {/* CONSEQUENCE + NEXT ACTION zone — the cool decision pane (mobile parity):
          the operational stake leads, then the action, set on --surface-cool so it
          reads as the place where you decide, distinct from the warm record. */}
      <div
        className="mt-3 rounded-md p-3"
        style={{
          background: atRisk
            ? "color-mix(in oklab, var(--danger-soft) 14%, var(--surface-cool))"
            : "color-mix(in oklab, var(--surface-cool) 55%, var(--surface-raised))",
          border: "1px solid color-mix(in oklab, var(--border-cool) 70%, transparent)",
        }}
      >
        {consequence ? (
          <p
            className="text-[12px] font-medium leading-snug"
            style={{ color: consequenceInk(consequence.tone) }}
          >
            {consequence.label}
          </p>
        ) : (
          <p className="text-[11.5px] leading-snug text-[var(--text-tertiary)]">No action needed right now.</p>
        )}
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px]" suppressHydrationWarning>
            <span className="ui-caps-3 text-[var(--text-tertiary)]">Updated</span>
            {row.lastUpdateAt ? <TimeChip date={row.lastUpdateAt} /> : <span className="text-[var(--text-tertiary)]">{"—"}</span>}
          </span>
          <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
        </div>
      </div>
    </li>
  );
}

function CardMeta({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <dt className="ui-caps-3 text-[var(--text-tertiary)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[12px]">{children}</dd>
    </div>
  );
}
