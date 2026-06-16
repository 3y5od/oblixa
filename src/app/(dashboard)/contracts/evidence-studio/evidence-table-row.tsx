import Link from "next/link";
import { EvidenceReleaseActions } from "@/components/evidence/evidence-release-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import type { EvidenceRow } from "@/lib/evidence/types";
import { dueDescriptor, EvidenceFileState, StatusIcon } from "./evidence-row-parts";

const EVIDENCE_BODY_CELL = "px-3 py-2.5 align-top";

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
  return (
    <tr className="ui-table-row group">
      <td
        className={`${EVIDENCE_BODY_CELL} pl-5 pr-3`}
        style={atRisk ? { boxShadow: "inset 3px 0 0 0 color-mix(in oklab, var(--danger-ink) 60%, transparent)" } : undefined}
      >
        <div className="min-w-0">
          <Link href={titleHref} title={row.requestTitle} className="block max-w-[26rem] truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]">
            {row.requestTitle}
          </Link>
          {row.contractHref ? (
            <Link href={row.contractHref} title={row.contractTitle} className="mt-0.5 block max-w-[26rem] truncate text-[11.5px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]">
              {row.contractTitle}
            </Link>
          ) : (
            <span className="mt-0.5 block max-w-[26rem] truncate text-[11.5px] text-[var(--text-tertiary)]">
              {row.contractTitle}
            </span>
          )}
        </div>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden lg:table-cell`}>
        {row.linkedObligationId ? (
          row.linkedObligationHref ? (
            <Link href={row.linkedObligationHref} title={row.linkedObligationTitle} className="block max-w-[15rem] truncate text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-strong)]">
              {row.linkedObligationTitle}
            </Link>
          ) : (
            <span className="block max-w-[15rem] truncate text-[12px] text-[var(--text-secondary)]">
              {row.linkedObligationTitle}
            </span>
          )
        ) : (
          <span className="text-[var(--text-tertiary)]">{"\u2014"}</span>
        )}
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden md:table-cell`}>
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
          <span className="text-[var(--text-tertiary)]">{"\u2014"}</span>
        )}
      </td>
      <td className={EVIDENCE_BODY_CELL}>
        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={row.statusTone} className="gap-1.5">
            <StatusIcon status={row.status} />
            {row.statusLabel}
          </StatusBadge>
          <EvidenceFileState row={row} />
        </div>
      </td>
      <td className={`${EVIDENCE_BODY_CELL} hidden 2xl:table-cell`} suppressHydrationWarning>
        {row.lastUpdateAt ? <TimeChip date={row.lastUpdateAt} /> : <span className="text-[var(--text-tertiary)]">{"\u2014"}</span>}
      </td>
      <td className={`${EVIDENCE_BODY_CELL} pl-3 pr-5`}>
        <EvidenceReleaseActions row={row} mutationsEnabled={mutationsEnabled} />
      </td>
    </tr>
  );
}

export { EVIDENCE_BODY_CELL };
