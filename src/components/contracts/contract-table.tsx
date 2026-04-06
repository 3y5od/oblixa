"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FileText, ChevronRight } from "lucide-react";
import type { Contract } from "@/lib/types";
import type { ContractReviewStats } from "@/lib/contract-review-stats";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/contracts";

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
      <div className="ui-card border-dashed border-zinc-300/90 p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-zinc-400" strokeWidth={1.25} />
        <h3 className="mt-4 text-sm font-semibold text-zinc-900">No contracts</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Upload your first contract to get started.
        </p>
        <Link href="/contracts/new" className="ui-btn-primary mt-6">
          Upload contract
        </Link>
      </div>
    );
  }

  return (
    <div className="ui-card overflow-x-auto shadow-none">
      <table className="min-w-full divide-y divide-zinc-200/90">
        <thead>
          <tr>
            <th className="ui-table-header px-6 py-3.5">Contract</th>
            <th className="ui-table-header px-6 py-3.5">Counterparty</th>
            <th className="ui-table-header px-6 py-3.5">Status</th>
            {reviewStats && (
              <th className="ui-table-header px-6 py-3.5">Field review</th>
            )}
            <th className="ui-table-header px-6 py-3.5">Owner</th>
            <th className="ui-table-header px-6 py-3.5">Created</th>
            <th className="relative px-6 py-3.5">
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/80">
          {contracts.map((contract) => {
            const stats = reviewStats?.[contract.id];
            return (
            <tr key={contract.id} className="transition-colors hover:bg-zinc-50/70">
              <td className="whitespace-nowrap px-6 py-4">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="text-sm font-medium text-zinc-900 transition-colors hover:text-sky-700"
                >
                  {contract.title}
                </Link>
                {contract.contract_type && (
                  <p className="text-xs text-zinc-500">{contract.contract_type}</p>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                {contract.counterparty || "—"}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[contract.status] || STATUS_STYLES.draft
                  }`}
                >
                  {STATUS_LABELS[contract.status] || contract.status}
                </span>
              </td>
              {reviewStats && (
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {stats && stats.total > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={
                          stats.pending > 0
                            ? "font-medium text-amber-900"
                            : "text-emerald-800"
                        }
                      >
                        {stats.pending > 0
                          ? `${stats.pending} pending`
                          : "Reviewed"}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {stats.approved} approved · {stats.total} fields
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-400">No fields</span>
                  )}
                </td>
              )}
              <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                {contract.owner?.full_name || contract.owner?.email || "—"}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                {format(new Date(contract.created_at), "MMM d, yyyy")}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="text-zinc-400 transition-colors hover:text-zinc-700"
                >
                  <ChevronRight size={16} strokeWidth={1.75} />
                </Link>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
