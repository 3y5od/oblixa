import Link from "next/link";
import { CheckCheck, Hourglass } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { STATUS_LABELS, STATUS_SEMANTICS } from "@/lib/contracts";
import { formatBusinessDateAtNoon, formatBusinessDateShort } from "@/lib/business-dates";
import { CellChip, ExceptionAlertChip, RowActionsMenu } from "./contract-table-chips";
import type { ContractTableBulkActions } from "./contract-table-types";
import { nextDateColor, reviewChipText, type ContractTableRowModel } from "./contract-table-utils";

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
        return (
          <li
            key={contract.id}
            className={`px-4 py-3 ${isSelected ? "bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)]" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              {bulkActions ? (
                <input
                  type="checkbox"
                  className="ui-checkbox"
                  aria-label={`Select ${contract.title}`}
                  checked={selected.has(contract.id)}
                  onChange={() => onToggle(contract.id)}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/contracts/${contract.id}`}
                  aria-label={`Open contract: ${contract.title}`}
                  title={contract.title}
                  dir="auto"
                  className="block min-w-0 truncate text-[13.5px] font-semibold text-[var(--text-primary)] [unicode-bidi:isolate]"
                >
                  {contract.title}
                </Link>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-tertiary)]">
                  {m.cp ? m.cp : "Missing counterparty"}
                  {m.type ? ` \u00b7 ${m.type}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5">
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
                  </span>
                  {!m.owner || m.owner.isEmailFallback ? (
                    <CellChip href={`/contracts/${contract.id}#ownership-record`} tone="warning" dashed>
                      Missing owner
                    </CellChip>
                  ) : null}
                  {m.sig?.nextHorizonDate ? (
                    <span
                      title={formatBusinessDateAtNoon(m.sig.nextHorizonDate)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tabular-nums"
                      style={{ color: nextDateColor(m.nextDateTone) }}
                    >
                      {m.horizonTypeLabel ? `${m.horizonTypeLabel} ` : ""}
                      {formatBusinessDateShort(m.sig.nextHorizonDate)}
                    </span>
                  ) : m.sig?.missingCriticalDates ? (
                    <CellChip href={`/contracts/${contract.id}#dates`} tone="warning" dashed ariaLabel="Critical contract dates missing">
                      Missing dates
                    </CellChip>
                  ) : null}
                  {m.review ? (
                    <CellChip href={m.review.href} tone={m.review.status === "success" ? "success" : "warning"} ariaLabel="Continue detail confirmation">
                      {m.review.status === "success" ? (
                        <CheckCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
                      ) : (
                        <Hourglass aria-hidden className="h-3 w-3" strokeWidth={2} />
                      )}
                      <span className="tabular-nums">{reviewChipText(m)}</span>
                    </CellChip>
                  ) : null}
                  {(m.sig?.openWorkCount ?? 0) > 0 ? (
                    <CellChip href={`/work?contract=${contract.id}`} tone="neutral">
                      <span className="tabular-nums">{m.sig?.openWorkCount}</span> open {m.sig?.openWorkCount === 1 ? "task" : "tasks"}
                    </CellChip>
                  ) : m.sig?.outstandingEvidenceCount && m.sig.outstandingEvidenceCount > 0 ? (
                    <CellChip href={`/evidence?contract=${contract.id}`} tone="warning">
                      <span className="tabular-nums">{m.sig.outstandingEvidenceCount}</span> evidence due
                    </CellChip>
                  ) : null}
                </div>
              </div>
              <RowActionsMenu contractId={contract.id} hasOwner={!!m.owner && !m.owner.isEmailFallback} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
