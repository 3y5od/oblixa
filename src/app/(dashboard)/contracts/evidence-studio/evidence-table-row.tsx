import Link from "next/link";
import { FileText } from "lucide-react";
import { EvidenceReleaseActions } from "@/components/evidence/evidence-release-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
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

const EVIDENCE_BODY_CELL = "px-3 py-3.5 align-top";

export function EvidenceTableRow({
  row,
  mutationsEnabled,
}: {
  row: EvidenceRow;
  mutationsEnabled: boolean;
}) {
  const atRisk = row.status === "overdue";
  const dueTone = row.status === "overdue" ? "danger" : row.dueState === "due_soon" ? "warning" : "neutral";
  const descriptor = dueDescriptor(row.dueInDays, row.status);
  const titleHref = row.display.requestTitle.href ?? row.href;
  const unassigned = row.requestOwnerLabel === "Unassigned";
  const consequence = evidenceConsequence(row);
  return (
    <tr className="ui-table-row group">
      {/* PURPOSE + IDENTITY zone — the parchment source block. A ruled
          requirement header ("Proof for …") leads so the proof's reason reads as
          the record's masthead, then the strong request title and quiet contract
          microtext, then the lifecycle rail. The whole cell carries warm
          --surface-inset paper so the request reads as a document, visibly
          distinct from the cool decision pane on the right (§13 source zone;
          product-owner direction #1/#2). */}
      <td
        className={`${EVIDENCE_BODY_CELL} pl-5 pr-4 ${
          atRisk
            ? "bg-[color:color-mix(in_oklab,var(--danger-soft)_12%,var(--surface-inset))] group-hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_20%,var(--surface-inset))]"
            : "bg-[color:color-mix(in_oklab,var(--surface-inset)_60%,var(--surface-raised))] group-hover:bg-[color:color-mix(in_oklab,var(--surface-inset)_82%,var(--surface-raised))]"
        }`}
        style={{
          boxShadow: atRisk
            ? "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 62%, transparent)"
            : "inset 3px 0 0 0 color-mix(in oklab, var(--border-strong) 50%, transparent)",
        }}
      >
        <div className="min-w-0 max-w-[34rem]">
          {row.linkedObligationId ? (
            <p className="mb-1.5 flex min-w-0 items-center gap-1.5 leading-snug">
              <FileText
                className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
                strokeWidth={1.85}
                aria-hidden
              />
              <span className="ui-caps-3 shrink-0 text-[10px] text-[var(--text-tertiary)]">Proof for</span>
              {row.linkedObligationHref ? (
                <Link
                  href={row.linkedObligationHref}
                  title={row.linkedObligationTitle}
                  className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--text-primary)] underline-offset-2 transition-colors hover:text-[var(--accent-strong)] hover:underline"
                >
                  {row.linkedObligationTitle}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {row.linkedObligationTitle}
                </span>
              )}
            </p>
          ) : (
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.65} aria-hidden />
              <span>Not linked to a requirement</span>
            </p>
          )}
          <Link
            href={titleHref}
            title={row.requestTitle}
            className="block truncate text-[15.5px] font-semibold leading-[1.22] tracking-tight text-[var(--text-primary)] underline-offset-[3px] transition-colors hover:text-[var(--accent-strong)] hover:underline"
          >
            {row.requestTitle}
          </Link>
          {row.contractHref ? (
            <Link
              href={row.contractHref}
              title={row.contractTitle}
              className="mt-0.5 block truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
            >
              {row.contractTitle}
            </Link>
          ) : (
            <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-tertiary)]">{row.contractTitle}</span>
          )}
          {/* PROGRESS zone — the lifecycle rail: where proof collection stands
              and what closes it. */}
          <div className="mt-3 max-w-[23rem]">
            <EvidenceLifecycle row={row} />
          </div>
        </div>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden pl-4 md:table-cell`}>
        <span title={row.requestOwnerLabel} className={`block max-w-[10rem] truncate ${unassigned ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
          {row.requestOwnerLabel}
        </span>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} tabular-nums`} suppressHydrationWarning>
        {row.dueAt ? (
          <div className="min-w-0">
            <TimeChip date={row.dueAt} format="calendar" tone={dueTone} />
            {descriptor ? <span className="mt-1 block text-[11px] text-[var(--text-tertiary)]">{descriptor}</span> : null}
          </div>
        ) : (
          <span className="text-[var(--text-tertiary)]">{"—"}</span>
        )}
      </td>
      <td className={EVIDENCE_BODY_CELL}>
        <div className="flex flex-col items-start gap-1.5">
          {/* The canonical status stays a chip; the file-state below it demotes to
              quiet text when the lifecycle stepper already inks "Missing file"
              (§16 — one critical chip per condition, not two). */}
          <StatusBadge status={row.statusTone} className="gap-1.5">
            <StatusIcon status={row.status} />
            {row.statusLabel}
          </StatusBadge>
          <EvidenceFileState row={row} lifecycleCoversFileState={fileGapOpen(row)} />
        </div>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden 2xl:table-cell`} suppressHydrationWarning>
        {row.lastUpdateAt ? <TimeChip date={row.lastUpdateAt} /> : <span className="text-[var(--text-tertiary)]">{"—"}</span>}
      </td>
      {/* CONSEQUENCE + NEXT ACTION zone — the cool decision pane (--surface-cool),
          set off by a cool rule so it never blends into the warm chrome. The
          operational stake leads (overdue proof keeps the linked requirement
          open), then the action sits directly beneath it, so the record answers
          "why does this matter?" and "what do I do?" as one weighted block, not a
          stray line in a wide row (§4 comprehension #5; §13 inspection pane). */}
      <td
        className={`${EVIDENCE_BODY_CELL} border-l border-[color:color-mix(in_oklab,var(--border-cool)_70%,transparent)] pl-4 pr-5 ${
          atRisk
            ? "bg-[color:color-mix(in_oklab,var(--danger-soft)_15%,var(--surface-cool))] group-hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_22%,var(--surface-cool))]"
            : "bg-[color:color-mix(in_oklab,var(--surface-cool)_55%,var(--surface-raised))] group-hover:bg-[color:color-mix(in_oklab,var(--surface-cool)_78%,var(--surface-raised))]"
        }`}
      >
        <div className="flex flex-col items-start gap-2">
          {consequence ? (
            <p
              className="max-w-[11rem] text-[11.5px] font-medium leading-snug"
              style={{ color: consequenceInk(consequence.tone) }}
            >
              {consequence.label}
            </p>
          ) : null}
          <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
        </div>
      </td>
    </tr>
  );
}

export { EVIDENCE_BODY_CELL };
