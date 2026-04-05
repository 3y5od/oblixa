"use client";

import Link from "next/link";
import { format } from "date-fns";
import { FileText, ChevronRight } from "lucide-react";
import type { Contract } from "@/lib/types";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/contracts";

interface ContractTableProps {
  contracts: Contract[];
}

export function ContractTable({ contracts }: ContractTableProps) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">No contracts</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload your first contract to get started.
        </p>
        <Link
          href="/contracts/new"
          className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upload contract
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Contract
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Counterparty
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Owner
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Created
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {contracts.map((contract) => (
            <tr key={contract.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  {contract.title}
                </Link>
                {contract.contract_type && (
                  <p className="text-xs text-gray-500">{contract.contract_type}</p>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {contract.counterparty || "—"}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    STATUS_STYLES[contract.status] || STATUS_STYLES.draft
                  }`}
                >
                  {STATUS_LABELS[contract.status] || contract.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {contract.owner?.full_name || contract.owner?.email || "—"}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {format(new Date(contract.created_at), "MMM d, yyyy")}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
