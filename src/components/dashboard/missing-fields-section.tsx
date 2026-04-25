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
      className="ui-status-panel ui-status-panel-warning scroll-mt-8 overflow-hidden px-0 py-0"
    >
      <div className="ui-surface-tint flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="ui-icon-tile-compact shrink-0">
            <AlertTriangle className="text-[var(--warning-ink)]" size={18} strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h2 id="missing-critical-heading" className="ui-section-title">
              Missing critical dates
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Active or in-review agreements without an approved end date, renewal
              date, or notice window. These gaps affect reminders and reporting.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Link href="/contracts/data-quality" className="ui-link text-center text-[13px] sm:text-right">
            Open data quality
          </Link>
          <Link
            href="/contracts/review"
            className="ui-btn-secondary px-4 py-2 text-[13px]"
          >
            Open review queue
          </Link>
        </div>
      </div>
      {contracts.length === 0 ? (
        <p className="px-6 py-10 text-center text-[13px] text-[var(--text-tertiary)]">
          All tracked contracts have at least one key date field approved.
        </p>
      ) : (
        <ul className="divide-y divide-[color:color-mix(in_oklab,var(--warning-soft)_54%,transparent)]">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contracts/${c.id}`}
                className="block px-6 py-4 transition-colors hover:bg-[color:color-mix(in_oklab,var(--warning-soft)_48%,transparent)]"
              >
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{c.title}</p>
                <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
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
