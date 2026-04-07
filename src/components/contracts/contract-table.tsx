"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FileText, ChevronRight } from "lucide-react";
import type { Contract } from "@/lib/types";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/contracts";
import { EmptyState } from "@/components/ui/empty-state";

interface ContractTableProps {
  contracts: Contract[];
  /** When set, shows extraction review progress per row. */
  reviewStats?: Record<string, ContractReviewStats>;
  /** Renders below the table inside the same card (e.g. pagination). */
  footer?: ReactNode;
}

export function ContractTable({ contracts, reviewStats, footer }: ContractTableProps) {
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
    <div className="overflow-hidden rounded-2xl border border-zinc-200/75 bg-white shadow-[var(--shadow-1)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[14px]">
          <thead className="sticky top-0 z-[1] bg-white">
            <tr className="border-b border-zinc-200/80">
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
                  className="ui-table-row border-b border-zinc-100/90 odd:bg-white even:bg-zinc-50/15 last:border-0"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 first:pl-6 lg:pl-8">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="block max-w-[22rem] truncate text-[14px] font-semibold text-zinc-900 transition-colors hover:text-[var(--accent)]"
                      title={contract.title}
                    >
                      {contract.title}
                    </Link>
                    {contract.contract_type && (
                      <p className="mt-0.5 text-[12px] font-medium text-zinc-400">
                        {contract.contract_type}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-zinc-600">
                    {contract.counterparty || "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <span
                      className={`ui-badge ${
                        STATUS_STYLES[contract.status] || STATUS_STYLES.draft
                      }`}
                    >
                      {STATUS_LABELS[contract.status] || contract.status}
                    </span>
                  </td>
                  {reviewStats && (
                    <td className="whitespace-nowrap px-5 py-3.5 text-[13px]">
                      {stats && stats.total > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={
                              stats.pending > 0
                                ? "font-semibold text-amber-800"
                                : "font-medium text-emerald-800"
                            }
                          >
                            {stats.pending > 0
                              ? `${stats.pending} pending`
                              : "Complete"}
                          </span>
                          <span className="text-[12px] text-zinc-400">
                            {stats.approved}/{stats.total} fields
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-zinc-600">
                    {contract.owner?.full_name || contract.owner?.email || "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-[13px] tabular-nums text-zinc-500">
                    {format(new Date(contract.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 pr-6 text-right lg:pr-8">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="inline-flex rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
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
