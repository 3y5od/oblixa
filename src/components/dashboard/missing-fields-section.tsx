import Link from "next/link";
import type { Contract } from "@/lib/types";

interface MissingFieldsSectionProps {
  contracts: Pick<Contract, "id" | "title" | "counterparty">[];
}

export function MissingFieldsSection({ contracts }: MissingFieldsSectionProps) {
  return (
    <div
      id="missing-critical"
      className="scroll-mt-6 rounded-lg border border-amber-200 bg-amber-50/60"
    >
      <div className="flex items-center justify-between border-b border-amber-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Missing critical dates
          </h2>
          <p className="mt-0.5 text-xs text-amber-900/80">
            Active or in-review contracts without an approved end date, renewal date, or notice window.
          </p>
        </div>
        <Link
          href="/contracts?status=active"
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          Browse contracts
        </Link>
      </div>
      {contracts.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-600">
          All tracked contracts have at least one of the key date fields approved.
        </p>
      ) : (
        <ul className="divide-y divide-amber-100">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contracts/${c.id}`}
                className="block px-6 py-3 hover:bg-amber-50"
              >
                <p className="text-sm font-medium text-gray-900">{c.title}</p>
                <p className="text-xs text-gray-500">
                  {c.counterparty || "No counterparty"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
