import Link from "next/link";
import type { Contract } from "@/lib/types";

interface MissingFieldsSectionProps {
  contracts: Pick<Contract, "id" | "title" | "counterparty">[];
}

export function MissingFieldsSection({ contracts }: MissingFieldsSectionProps) {
  return (
    <div
      id="missing-critical"
      className="scroll-mt-6 rounded-xl border border-amber-200/80 bg-amber-50/40"
    >
      <div className="flex items-center justify-between border-b border-amber-200/70 px-6 py-4">
        <div>
          <h2 className="ui-section-title">Missing critical dates</h2>
          <p className="mt-1 text-xs text-amber-950/75">
            Active or in-review contracts without an approved end date, renewal date, or notice window.
          </p>
        </div>
        <Link href="/contracts/review" className="ui-link text-sm">
          Review queue
        </Link>
      </div>
      {contracts.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-zinc-600">
          All tracked contracts have at least one of the key date fields approved.
        </p>
      ) : (
        <ul className="divide-y divide-amber-200/50">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contracts/${c.id}`}
                className="block px-6 py-3.5 transition-colors hover:bg-amber-50/60"
              >
                <p className="text-sm font-medium text-zinc-900">{c.title}</p>
                <p className="text-xs text-zinc-500">
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
