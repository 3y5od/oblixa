import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Contract } from "@/lib/types";

interface MissingFieldsSectionProps {
  contracts: Pick<Contract, "id" | "title" | "counterparty">[];
}

export function MissingFieldsSection({ contracts }: MissingFieldsSectionProps) {
  return (
    <section
      id="missing-critical"
      role="region"
      aria-labelledby="missing-critical-heading"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-orange-200/60 bg-gradient-to-br from-orange-50/40 via-white to-white"
    >
      <div className="flex flex-col gap-4 border-b border-orange-100/80 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-200/60 bg-white shadow-sm">
            <AlertTriangle className="text-orange-700" size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h2 id="missing-critical-heading" className="ui-section-title">
              Missing critical dates
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-zinc-600">
              Active or in-review agreements without an approved end date, renewal
              date, or notice window. These gaps affect reminders and reporting.
            </p>
          </div>
        </div>
        <Link
          href="/contracts/review"
          className="ui-btn-secondary shrink-0 self-start px-4 py-2 text-[13px]"
        >
          Open review queue
        </Link>
      </div>
      {contracts.length === 0 ? (
        <p className="px-6 py-10 text-center text-[13px] text-zinc-500">
          All tracked contracts have at least one key date field approved.
        </p>
      ) : (
        <ul className="divide-y divide-orange-100/60">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contracts/${c.id}`}
                className="block px-6 py-4 transition-colors hover:bg-orange-50/40"
              >
                <p className="text-[15px] font-semibold text-zinc-900">{c.title}</p>
                <p className="mt-0.5 text-[13px] text-zinc-500">
                  {c.counterparty || "No counterparty"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
