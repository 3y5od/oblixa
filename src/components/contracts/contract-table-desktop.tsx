import Link from "next/link";
import type { RefObject } from "react";
import { isValid } from "date-fns";
import { CheckCheck, Hourglass } from "lucide-react";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { StatusBadge } from "@/components/ui/status-badge";
import { TimeChip } from "@/components/ui/time-chip";
import { STATUS_LABELS, STATUS_SEMANTICS } from "@/lib/contracts";
import { formatBusinessDateAtNoon, formatBusinessDateShort } from "@/lib/business-dates";
import { CellChip, ExceptionAlertChip, OpenContractChip, RowActionsMenu } from "./contract-table-chips";
import type { ContractTableBulkActions } from "./contract-table-types";
import { nextDateColor, reviewChipText, type ContractTableRowModel } from "./contract-table-utils";

const headerCellClass =
  "px-3 py-2 text-left text-[10.5px] font-semibold uppercase text-[var(--text-tertiary)] whitespace-nowrap";
const bodyCellClass = "px-3 py-2.5 align-middle";
const selectionCellClass =
  "box-border w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] pl-4 pr-2 align-middle";

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
        <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_82%,var(--surface-raised))]">
          <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)]">
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
            <th scope="col" className={`${headerCellClass} min-w-[15rem]`}>Contract</th>
            <th scope="col" className={`${headerCellClass} min-w-[10rem]`}>Counterparty</th>
            <th scope="col" className={`${headerCellClass} min-w-[7rem]`}>Owner</th>
            <th scope="col" className={`${headerCellClass} min-w-[9.5rem]`}>Status</th>
            <th scope="col" aria-label="Next important date" className={`${headerCellClass} min-w-[8rem]`}>
              Next date
            </th>
            <th scope="col" aria-label="Review state" className={`${headerCellClass} min-w-[7.5rem]`}>
              Review
            </th>
            <th scope="col" aria-label="Open tasks" className={`${headerCellClass} min-w-[5.5rem]`}>
              Tasks
            </th>
            <th scope="col" aria-label="Last updated" className={`${headerCellClass} min-w-[5rem]`}>
              Updated
            </th>
            <th scope="col" className="w-[6.5rem] px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rowModels.map((m) => {
            const contract = m.contract;
            const isSelected = !!bulkActions && selected.has(contract.id);
            return (
              <tr key={contract.id} className={`ui-table-row group${isSelected ? " ui-table-row-selected" : ""}`}>
                {bulkActions ? (
                  <td className={`${selectionCellClass} py-2.5`}>
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
                <td className={bodyCellClass}>
                  <div className="min-w-0">
                    <Link
                      href={`/contracts/${contract.id}`}
                      title={contract.title}
                      dir="auto"
                      className="block truncate font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)] [unicode-bidi:isolate]"
                    >
                      {contract.title}
                    </Link>
                    {showContinuityLinks ? (
                      <div className="mt-1">
                        <ContractContinuityLinks contractId={contract.id} omit={["contract", "work"]} />
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className={bodyCellClass}>
                  {!m.cp ? (
                    <CellChip href={`/contracts/${contract.id}#counterparty`} tone="warning" dashed title="Counterparty not set">
                      Missing counterparty
                    </CellChip>
                  ) : (
                    <div className="min-w-0">
                      <span
                        className="block truncate text-[var(--text-primary)]"
                        title={m.cpFallback ? `Counterparty name missing \u2014 currently shows "${m.cp}"` : undefined}
                      >
                        {m.cp}
                      </span>
                      {m.type ? (
                        <span
                          className="block truncate text-[11px] text-[var(--text-tertiary)]"
                          title={m.typeFallback ? `Contract type unclassified \u2014 currently shows "${m.type}"` : undefined}
                        >
                          {m.type}
                        </span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className={bodyCellClass}>
                  {!m.owner || m.owner.isEmailFallback ? (
                    <CellChip
                      href={`/contracts/${contract.id}#ownership-record`}
                      tone="warning"
                      dashed
                      title={m.owner?.isEmailFallback ? `Owner not set \u2014 only email on file (${m.owner.tooltip ?? ""})` : "Owner not assigned"}
                    >
                      Missing owner
                    </CellChip>
                  ) : (
                    <span className="block truncate text-[var(--text-primary)]" title={m.owner.tooltip}>
                      {m.owner.display}
                    </span>
                  )}
                </td>
                <td className={bodyCellClass}>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={STATUS_SEMANTICS[contract.status] ?? STATUS_SEMANTICS.draft} className="gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                        style={{ boxShadow: "0 0 0 2px color-mix(in oklab, currentColor 22%, transparent)" }}
                      />
                      {STATUS_LABELS[contract.status] || contract.status}
                    </StatusBadge>
                    {m.sig?.openExceptionCount && m.sig.openExceptionCount > 0 ? (
                      <ExceptionAlertChip contractId={contract.id} count={m.sig.openExceptionCount} />
                    ) : null}
                  </div>
                </td>
                <td className={`${bodyCellClass} tabular-nums`}>
                  {m.sig?.nextHorizonDate ? (
                    <div className="min-w-0">
                      <span className="flex items-baseline gap-1.5">
                        {m.horizonTypeLabel ? (
                          <span className="ui-caps-3 shrink-0 text-[9.5px] text-[var(--text-tertiary)]">{m.horizonTypeLabel}</span>
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
                          className="mt-0.5 block text-[11px] tabular-nums"
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
                </td>
                <td className={`${bodyCellClass} tabular-nums`}>
                  {m.review ? (
                    <CellChip href={m.review.href} tone={m.review.status === "success" ? "success" : "warning"} ariaLabel="Continue detail confirmation">
                      {m.review.status === "success" ? (
                        <CheckCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
                      ) : (
                        <Hourglass aria-hidden className="h-3 w-3" strokeWidth={2} />
                      )}
                      <span className="tabular-nums">{reviewChipText(m)}</span>
                    </CellChip>
                  ) : (
                    <span className="text-[11px] text-[var(--text-tertiary)]" title="No suggested details to confirm">
                      None
                    </span>
                  )}
                </td>
                <td className={`${bodyCellClass} tabular-nums`}>
                  {(m.sig?.openWorkCount ?? 0) > 0 ? (
                    <CellChip href={`/work?contract=${contract.id}`} tone="neutral">
                      {m.sig?.openWorkCount} open {m.sig?.openWorkCount === 1 ? "task" : "tasks"}
                    </CellChip>
                  ) : m.sig?.outstandingEvidenceCount && m.sig.outstandingEvidenceCount > 0 ? (
                    <CellChip href={`/evidence?contract=${contract.id}`} tone="warning">
                      {m.sig.outstandingEvidenceCount} evidence due
                    </CellChip>
                  ) : (
                    <span className="text-[11px] text-[var(--text-tertiary)]">None</span>
                  )}
                </td>
                <td className={`${bodyCellClass} tabular-nums`} suppressHydrationWarning>
                  {isValid(m.updatedDate) ? (
                    <span className={m.updatedStale ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]"}>
                      <TimeChip date={m.updatedDate} />
                    </span>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">{"\u2014"}</span>
                  )}
                </td>
                <td className={`${bodyCellClass} w-[6.5rem]`}>
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
