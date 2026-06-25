import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCheck, Hourglass } from "lucide-react";
import { STATUS_LABELS } from "@/lib/contracts";
import { formatBusinessDateAtNoon, formatBusinessDateShort } from "@/lib/business-dates";
import { CellChip, ExceptionAlertChip, RowActionsMenu } from "./contract-table-chips";
import type { ContractTableBulkActions } from "./contract-table-types";
import {
  nextDateColor,
  reviewChipText,
  statusDescriptor,
  statusInkColor,
  type ContractRecordConditionTone,
  type ContractTableRowModel,
} from "./contract-table-utils";

function conditionInk(tone: ContractRecordConditionTone) {
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "var(--text-tertiary)";
}

// One labelled entry in the compact mobile ledger — keeps the supporting data
// grouped and named instead of a loose chip row, so the card reads as
// operationally complete rather than a half-empty band with a floating menu.
function MobileLedgerEntry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{label}</p>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}

export function ContractTableMobile({
  rowModels,
  bulkActions,
  selected,
  onToggle,
}: {
  rowModels: ContractTableRowModel[];
  bulkActions?: ContractTableBulkActions;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_84%,transparent)]">
      {rowModels.map((m) => {
        const contract = m.contract;
        const isSelected = !!bulkActions && selected.has(contract.id);
        const sd = statusDescriptor(contract.status);
        const statusInk = statusInkColor(sd.tone);
        const followUpCount = m.sig?.openWorkCount ?? 0;
        const evidenceCount = m.sig?.outstandingEvidenceCount ?? 0;
        return (
          <li
            key={contract.id}
            className={`px-4 py-3 ${isSelected ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]" : ""}`}
          >
            {/* Header row: checkbox + identity, with the row-actions kebab pinned
                to the top so it never floats beside a tall empty column. */}
            <div className="flex items-start gap-2.5">
              {bulkActions ? (
                <input
                  type="checkbox"
                  className="ui-checkbox mt-0.5"
                  aria-label={`Select ${contract.title}`}
                  checked={selected.has(contract.id)}
                  onChange={() => onToggle(contract.id)}
                />
              ) : null}
              <div
                className="min-w-0 flex-1 border-l-2 pl-3"
                style={{
                  borderColor: m.condition
                    ? conditionInk(m.condition.tone)
                    : "color-mix(in oklab, var(--border-strong) 45%, transparent)",
                }}
              >
                <Link
                  href={`/contracts/${contract.id}`}
                  aria-label={`Open contract: ${contract.title}`}
                  title={contract.title}
                  dir="auto"
                  className="block min-w-0 truncate text-[14.5px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] [unicode-bidi:isolate]"
                >
                  {contract.title}
                </Link>
                <p className="mt-1 truncate text-[12px] text-[var(--text-secondary)]">
                  {m.cp ? m.cp : "Missing counterparty"}
                  {m.cp && m.type ? ` ${"·"} ${m.type}` : ""}
                </p>
                {m.condition ? (
                  <p
                    className="mt-1.5 text-[11.5px] font-medium leading-snug"
                    style={{ color: conditionInk(m.condition.tone) }}
                  >
                    {m.condition.text}
                  </p>
                ) : null}
              </div>
              <RowActionsMenu contractId={contract.id} hasOwner={!!m.owner && !m.owner.isEmailFallback} />
            </div>

            {/* Operational ledger: a tinted, ruled sub-block re-grouping the
                supporting data into labelled entries (mirrors the desktop right
                ledger), so the small-screen record is read-as-complete. */}
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-md border border-[color:color-mix(in_oklab,var(--border-strong)_34%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-inset)_28%,var(--surface-raised))] px-3 py-2.5">
              <MobileLedgerEntry label="Owner">
                {!m.owner || m.owner.isEmailFallback ? (
                  <CellChip href={`/contracts/${contract.id}#ownership-record`} tone="warning" dashed>
                    Missing owner
                  </CellChip>
                ) : (
                  <span className="block truncate text-[12px] text-[var(--text-primary)]" title={m.owner.tooltip}>
                    {m.owner.display}
                  </span>
                )}
              </MobileLedgerEntry>

              <MobileLedgerEntry label="Status">
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: statusInk, boxShadow: `0 0 0 2px color-mix(in oklab, ${statusInk} 20%, transparent)` }}
                  />
                  <span className="truncate text-[12px] font-semibold tracking-tight" style={{ color: statusInk }}>
                    {STATUS_LABELS[contract.status] || contract.status}
                  </span>
                </div>
                {m.sig?.openExceptionCount && m.sig.openExceptionCount > 0 ? (
                  <div className="mt-1.5">
                    <ExceptionAlertChip contractId={contract.id} count={m.sig.openExceptionCount} />
                  </div>
                ) : null}
              </MobileLedgerEntry>

              <MobileLedgerEntry label="Next date">
                {m.sig?.nextHorizonDate ? (
                  <span
                    title={formatBusinessDateAtNoon(m.sig.nextHorizonDate)}
                    className="inline-flex items-baseline gap-1 text-[12px] font-semibold leading-none tabular-nums"
                    style={{ color: nextDateColor(m.nextDateTone) }}
                  >
                    {m.horizonTypeLabel ? (
                      <span className="text-[10px] font-medium text-[var(--text-tertiary)]">{m.horizonTypeLabel}</span>
                    ) : null}
                    {formatBusinessDateShort(m.sig.nextHorizonDate)}
                  </span>
                ) : m.sig?.missingCriticalDates ? (
                  <CellChip href={`/contracts/${contract.id}#dates`} tone="warning" dashed ariaLabel="Critical contract dates missing">
                    Missing dates
                  </CellChip>
                ) : (
                  <span className="text-[11px] text-[var(--text-tertiary)]">No date set</span>
                )}
              </MobileLedgerEntry>

              <MobileLedgerEntry label="Detail review">
                {m.review ? (
                  <Link
                    href={m.review.href}
                    aria-label="Continue detail confirmation"
                    className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums"
                    style={{ color: m.review.status === "success" ? "var(--success-ink)" : "var(--warning-ink)" }}
                  >
                    {m.review.status === "success" ? (
                      <CheckCheck aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    ) : (
                      <Hourglass aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    )}
                    {/* "to confirm" / "confirmed" + the amber/green glyph already
                        name the trust state inline, so a suggested value never
                        reads as trusted on the compact row (§18.8). */}
                    <span className="tabular-nums">{reviewChipText(m)}</span>
                  </Link>
                ) : (
                  <span className="text-[11px] text-[var(--text-tertiary)]">None</span>
                )}
              </MobileLedgerEntry>

              <MobileLedgerEntry label="Follow-up">
                {followUpCount > 0 ? (
                  <Link
                    href={`/work?contract=${contract.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums text-[var(--text-secondary)]"
                  >
                    <span className="tabular-nums">{followUpCount}</span> open {followUpCount === 1 ? "task" : "tasks"}
                  </Link>
                ) : evidenceCount > 0 ? (
                  <Link
                    href={`/evidence?contract=${contract.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums text-[var(--warning-ink)]"
                  >
                    {evidenceCount} evidence due
                  </Link>
                ) : (
                  <span className="text-[11px] text-[var(--text-tertiary)]">None</span>
                )}
              </MobileLedgerEntry>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
