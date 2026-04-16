"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FileText, ChevronRight } from "lucide-react";
import type { Contract } from "@/lib/types";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import { STATUS_SEMANTICS, STATUS_LABELS } from "@/lib/contracts";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { surfaceTestIds } from "@/lib/qa/test-ids";

interface ContractTableProps {
  contracts: Contract[];
  /** When set, shows extraction review progress per row. */
  reviewStats?: Record<string, ContractReviewStats>;
  /** Per-row “Open in” links (docs/refinement.md §16.3). */
  showContinuityLinks?: boolean;
  /** Renders below the table inside the same card (e.g. pagination). */
  footer?: ReactNode;
}

export function ContractTable({ contracts, reviewStats, showContinuityLinks, footer }: ContractTableProps) {
  if (contracts.length === 0) {
    return (
      <EmptyState
        title="No contracts yet"
        copy="Upload an agreement to extract dates and build your operational record."
        icon={
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-50/80">
            <FileText className="h-7 w-7 text-zinc-400" strokeWidth={1.25} aria-hidden />
          </div>
        }
        action={
          <Link href="/contracts/new" className="ui-btn-primary px-6">
            Upload contract
          </Link>
        }
      />
    );
  }

  return (
    <div className="ui-table-shell">
      <div className="overflow-x-auto">
        <table data-testid={surfaceTestIds.contractsTable} className="min-w-full border-collapse text-[14px]">
          <thead className="sticky top-0 z-[1] bg-surface">
            <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5 first:pl-6 lg:pl-8">
                Contract
              </th>
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Counterparty</th>
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Status</th>
              {reviewStats && (
                <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Review</th>
              )}
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Owner</th>
              <th className="ui-table-header whitespace-nowrap px-5 py-2.5">Created</th>
              <th className="relative whitespace-nowrap px-5 py-2.5 pr-6 lg:pr-8">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const stats = reviewStats?.[contract.id];
              return (
                <tr
                  key={contract.id}
                  className="ui-table-row odd:bg-[color:color-mix(in_oklab,var(--surface)_82%,transparent)] even:bg-[color:color-mix(in_oklab,var(--surface-muted)_54%,transparent)] last:border-0"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 first:pl-6 lg:pl-8">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="block max-w-[22rem] truncate text-[14px] font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)]"
                      title={contract.title}
                    >
                      {contract.title}
                    </Link>
                    {contract.contract_type && (
                      <p className="mt-0.5 text-[12px] font-medium text-[var(--text-tertiary)]">
                        {contract.contract_type}
                      </p>
                    )}
                    {showContinuityLinks ? (
                      <ContractContinuityLinks contractId={contract.id} />
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-[var(--text-secondary)]">
                    {contract.counterparty || "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <StatusBadge status={STATUS_SEMANTICS[contract.status] ?? STATUS_SEMANTICS.draft}>
                      {STATUS_LABELS[contract.status] || contract.status}
                    </StatusBadge>
                  </td>
                  {reviewStats && (
                    <td className="whitespace-nowrap px-5 py-3.5 text-[13px]">
                      {stats && stats.total > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={
                              stats.pending > 0
                                ? "font-semibold text-[var(--warning-ink)]"
                                : "font-medium text-[var(--success-ink)]"
                            }
                          >
                            {stats.pending > 0
                              ? `${stats.pending} pending`
                              : "Complete"}
                          </span>
                          <span className="text-[12px] text-[var(--text-tertiary)]">
                            {stats.approved}/{stats.total} fields
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-[var(--text-secondary)]">
                    {contract.owner?.full_name || contract.owner?.email || "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[13px] tabular-nums text-[var(--text-tertiary)]">
                    {format(new Date(contract.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 pr-6 text-right lg:pr-8">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="inline-flex rounded-[0.9rem] p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)] hover:text-[var(--text-primary)]"
                      aria-label={`Open ${contract.title}`}
                    >
                      <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
