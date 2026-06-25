import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { isValid } from "date-fns";
import { CheckCheck, Hourglass } from "lucide-react";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { TimeChip } from "@/components/ui/time-chip";
import { STATUS_LABELS } from "@/lib/contracts";
import { formatBusinessDateAtNoon, formatBusinessDateShort } from "@/lib/business-dates";
import { CellChip, ExceptionAlertChip, OpenContractChip, RowActionsMenu } from "./contract-table-chips";
import type { ContractTableBulkActions } from "./contract-table-types";
import {
  nextDateColor,
  reviewChipText,
  statusDescriptor,
  statusInkColor,
  type ContractRecordConditionTone,
  type ContractTableRowModel,
} from "./contract-table-utils";

const headerCellClass =
  "px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] whitespace-nowrap";
// Records get vertical breathing room but the frame stays tight — the right
// ledger carries the supporting data so the row is never a wide half-empty band.
const bodyCellClass = "px-3 py-3 align-top";

function conditionInk(tone: ContractRecordConditionTone) {
  if (tone === "danger") return "var(--danger-ink)";
  if (tone === "warning") return "var(--warning-ink)";
  return "var(--text-tertiary)";
}
const selectionCellClass =
  "box-border w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] pl-4 pr-2 align-top";

// One labelled entry inside the right operational ledger. The label is a quiet
// uppercase microtag; the value carries the ink. Grouping label+value in a ruled
// sub-cell is what turns the stripped-out columns into a single read-as-complete
// supporting block (§13 ledger subregion, §14 label makes the value legible).
function LedgerEntry({
  label,
  children,
  cool,
}: {
  label: string;
  children: ReactNode;
  cool?: boolean;
}) {
  return (
    <div
      className={`min-w-0 px-3 py-2 ${
        cool
          ? "bg-[color:color-mix(in_oklab,var(--surface-cool)_60%,transparent)]"
          : ""
      }`}
    >
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}

export function ContractTableDesktop({
  rowModels,
  bulkActions,
  selected,
  allVisibleSelected,
  selectAllRef,
  showContinuityLinks,
  onToggleAllVisible,
  onToggle,
}: {
  rowModels: ContractTableRowModel[];
  bulkActions?: ContractTableBulkActions;
  selected: Set<string>;
  allVisibleSelected: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
  showContinuityLinks?: boolean;
  onToggleAllVisible: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto [contain:inline-size]">
      <table className="w-full border-collapse text-[12.5px]" aria-label="Contracts in this workspace">
        <caption className="border-b border-[color:color-mix(in_oklab,var(--border-strong)_40%,transparent)] bg-[var(--surface-raised)] px-3 py-2 text-left">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Contract operations register
            </span>
            <span className="text-[11px] leading-snug text-[var(--text-tertiary)]">
              One row per signed contract - the record on the left, its operational ledger on the right.
            </span>
          </span>
        </caption>
        <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_90%,var(--surface-raised))]">
          <tr className="border-b-2 border-[color:color-mix(in_oklab,var(--border-strong)_60%,transparent)]">
            {bulkActions ? (
              <th scope="col" className={`${selectionCellClass} py-2`}>
                <div className="flex items-center justify-start">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="ui-checkbox"
                    aria-label="Select all contracts on this page"
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                  />
                </div>
                <span className="sr-only">Select all on page</span>
              </th>
            ) : null}
            {/* Two-part record: a dominant identity/condition column, then one
                ruled "operational ledger" column that re-groups the supporting
                data so the right half is used, not left blank. The ledger header
                names every grouped field for screen-reader users. */}
            <th scope="col" className={`${headerCellClass} min-w-[22rem]`}>
              Contract record
            </th>
            <th
              scope="col"
              aria-label="Operational ledger: Owner, Status, Next important date, Review state, Open tasks, Last updated"
              className={`${headerCellClass} border-l border-[color:color-mix(in_oklab,var(--border-strong)_45%,transparent)] min-w-[28rem]`}
            >
              Operational ledger
            </th>
            <th
              scope="col"
              className="w-[5.5rem] border-l border-[color:color-mix(in_oklab,var(--border-strong)_45%,transparent)] px-3 py-2"
            >
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rowModels.map((m) => {
            const contract = m.contract;
            const isSelected = !!bulkActions && selected.has(contract.id);
            const sd = statusDescriptor(contract.status);
            const statusInk = statusInkColor(sd.tone);
            const followUpCount = m.sig?.openWorkCount ?? 0;
            const evidenceCount = m.sig?.outstandingEvidenceCount ?? 0;
            return (
              <tr key={contract.id} className={`ui-table-row group${isSelected ? " ui-table-row-selected" : ""}`}>
                {bulkActions ? (
                  <td className={`${selectionCellClass} py-3`}>
                    <div className="flex items-center justify-start">
                      <input
                        type="checkbox"
                        className="ui-checkbox"
                        aria-label={`Select ${contract.title}`}
                        checked={selected.has(contract.id)}
                        onChange={() => onToggle(contract.id)}
                      />
                    </div>
                  </td>
                ) : null}

                {/* LEFT — identity, condition, consequence. The condition tone
                    rule on the left edge makes the record's urgency readable
                    before any text is parsed. */}
                <td className={bodyCellClass}>
                  <div
                    className="min-w-0 border-l-2 pl-3"
                    style={{
                      borderColor: m.condition
                        ? conditionInk(m.condition.tone)
                        : "color-mix(in oklab, var(--border-strong) 45%, transparent)",
                    }}
                  >
                    <Link
                      href={`/contracts/${contract.id}`}
                      title={contract.title}
                      dir="auto"
                      className="block truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] underline-offset-2 transition-colors hover:underline [unicode-bidi:isolate]"
                    >
                      {contract.title}
                    </Link>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                      {!m.cp ? (
                        <CellChip href={`/contracts/${contract.id}#counterparty`} tone="warning" dashed title="Counterparty not set">
                          Missing counterparty
                        </CellChip>
                      ) : (
                        <span
                          className="min-w-0 truncate text-[12.5px] text-[var(--text-secondary)]"
                          title={m.cpFallback ? `Counterparty name missing - currently shows "${m.cp}"` : undefined}
                        >
                          {m.cp}
                        </span>
                      )}
                      {m.cp && m.type ? (
                        <>
                          <span aria-hidden className="text-[var(--text-tertiary)]">{"·"}</span>
                          <span
                            className="min-w-0 truncate text-[11.5px] text-[var(--text-tertiary)]"
                            title={m.typeFallback ? `Contract type unclassified - currently shows "${m.type}"` : undefined}
                          >
                            {m.type}
                          </span>
                        </>
                      ) : null}
                    </div>
                    {m.condition ? (
                      <p
                        className="mt-1.5 text-[11.5px] font-medium leading-snug"
                        style={{ color: conditionInk(m.condition.tone) }}
                      >
                        {m.condition.text}
                      </p>
                    ) : null}
                    {showContinuityLinks ? (
                      <div className="mt-1.5">
                        <ContractContinuityLinks contractId={contract.id} omit={["contract", "work"]} />
                      </div>
                    ) : null}
                  </div>
                </td>

                {/* RIGHT — the operational ledger. A ruled, parchment-tinted
                    subregion that re-groups the supporting data into labelled
                    entries so the record reads as operationally complete and the
                    full row width is used. The inner divides are real ledger
                    rules, not a second table. */}
                <td className="border-l border-[color:color-mix(in_oklab,var(--border-strong)_45%,transparent)] p-2 align-top">
                  <div className="grid min-w-0 grid-cols-2 overflow-hidden rounded-md border border-[color:color-mix(in_oklab,var(--border-strong)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-inset)_30%,var(--surface-raised))] [&>*]:border-[color:color-mix(in_oklab,var(--border-strong)_28%,transparent)] [&>*:nth-child(n+3)]:border-t [&>*:nth-child(even)]:border-l">
                    {/* Owner — who reminders route to. */}
                    <LedgerEntry label="Owner">
                      {!m.owner || m.owner.isEmailFallback ? (
                        <CellChip
                          href={`/contracts/${contract.id}#ownership-record`}
                          tone="warning"
                          dashed
                          title={m.owner?.isEmailFallback ? `Owner not set - only email on file (${m.owner.tooltip ?? ""})` : "Owner not assigned"}
                        >
                          Missing owner
                        </CellChip>
                      ) : (
                        <>
                          <span className="block truncate text-[12.5px] text-[var(--text-primary)]" title={m.owner.tooltip}>
                            {m.owner.display}
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-snug text-[var(--text-tertiary)]">
                            Routes reminders
                          </span>
                        </>
                      )}
                    </LedgerEntry>

                    {/* Status — condition of the lifecycle state. */}
                    <LedgerEntry label="Status" cool>
                      <div className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: statusInk,
                            boxShadow: `0 0 0 2px color-mix(in oklab, ${statusInk} 20%, transparent)`,
                          }}
                        />
                        <span className="truncate text-[12.5px] font-semibold tracking-tight" style={{ color: statusInk }}>
                          {STATUS_LABELS[contract.status] || contract.status}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[10.5px] leading-snug text-[var(--text-tertiary)]">{sd.descriptor}</p>
                      {m.sig?.openExceptionCount && m.sig.openExceptionCount > 0 ? (
                        <div className="mt-1.5">
                          <ExceptionAlertChip contractId={contract.id} count={m.sig.openExceptionCount} />
                        </div>
                      ) : null}
                    </LedgerEntry>

                    {/* Next important date — renewal / notice / end horizon. */}
                    <LedgerEntry label="Next date">
                      {m.sig?.nextHorizonDate ? (
                        <div className="min-w-0 tabular-nums">
                          <span className="flex items-baseline gap-1.5">
                            {m.horizonTypeLabel ? (
                              <span className="shrink-0 text-[10px] font-medium text-[var(--text-tertiary)]">{m.horizonTypeLabel}</span>
                            ) : null}
                            <span
                              title={formatBusinessDateAtNoon(m.sig.nextHorizonDate)}
                              className="truncate text-[12.5px] font-semibold tabular-nums"
                              style={{ color: nextDateColor(m.nextDateTone) }}
                            >
                              {formatBusinessDateShort(m.sig.nextHorizonDate)}
                            </span>
                          </span>
                          {m.horizonRelative ? (
                            <span
                              className="mt-0.5 block text-[10.5px] tabular-nums"
                              style={{
                                color:
                                  m.nextDateTone === "danger"
                                    ? "var(--danger-ink)"
                                    : m.nextDateTone === "warning"
                                      ? "var(--warning-ink)"
                                      : "var(--text-secondary)",
                              }}
                            >
                              {m.horizonRelative}
                            </span>
                          ) : null}
                        </div>
                      ) : m.sig?.missingCriticalDates ? (
                        <CellChip href={`/contracts/${contract.id}#dates`} tone="warning" dashed ariaLabel="Critical contract dates missing">
                          Missing dates
                        </CellChip>
                      ) : (
                        <span className="text-[11px] text-[var(--text-tertiary)]" title="No upcoming renewal, notice, or end date">
                          No date set
                        </span>
                      )}
                    </LedgerEntry>

                    {/* Review state — suggested vs confirmed detail trust. */}
                    <LedgerEntry label="Detail review" cool>
                      {m.review ? (
                        <div className="min-w-0 tabular-nums">
                          <Link
                            href={m.review.href}
                            aria-label="Continue detail confirmation"
                            className="group/review inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums transition-colors"
                            style={{ color: m.review.status === "success" ? "var(--success-ink)" : "var(--warning-ink)" }}
                          >
                            {m.review.status === "success" ? (
                              <CheckCheck aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                            ) : (
                              <Hourglass aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                            )}
                            <span className="tabular-nums underline-offset-2 group-hover/review:underline">{reviewChipText(m)}</span>
                          </Link>
                          {m.review.status === "success" ? null : (
                            <span className="mt-0.5 block text-[10px] leading-snug text-[var(--warning-ink)]">
                              Suggested - not yet confirmed
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-tertiary)]" title="No suggested details to confirm">
                          None
                        </span>
                      )}
                    </LedgerEntry>

                    {/* Follow-up — open tasks / outstanding evidence. */}
                    <LedgerEntry label="Follow-up">
                      {followUpCount > 0 ? (
                        <Link
                          href={`/work?contract=${contract.id}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums text-[var(--text-secondary)] underline-offset-2 transition-colors hover:text-[var(--text-primary)] hover:underline"
                        >
                          {followUpCount} open {followUpCount === 1 ? "task" : "tasks"}
                        </Link>
                      ) : evidenceCount > 0 ? (
                        <Link
                          href={`/evidence?contract=${contract.id}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums text-[var(--warning-ink)] underline-offset-2 transition-colors hover:underline"
                        >
                          {evidenceCount} evidence due
                        </Link>
                      ) : (
                        <span className="text-[11px] text-[var(--text-tertiary)]">None</span>
                      )}
                    </LedgerEntry>

                    {/* Last updated — record freshness. */}
                    <LedgerEntry label="Updated" cool>
                      <span className="tabular-nums" suppressHydrationWarning>
                        {isValid(m.updatedDate) ? (
                          <span className={m.updatedStale ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"}>
                            <TimeChip date={m.updatedDate} />
                          </span>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">{"—"}</span>
                        )}
                      </span>
                    </LedgerEntry>
                  </div>
                </td>

                <td className="border-l border-[color:color-mix(in_oklab,var(--border-strong)_45%,transparent)] px-3 py-3 align-top">
                  <div className="flex items-center justify-end gap-1.5">
                    <OpenContractChip contractId={contract.id} title={contract.title} />
                    <RowActionsMenu contractId={contract.id} hasOwner={!!m.owner && !m.owner.isEmailFallback} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
