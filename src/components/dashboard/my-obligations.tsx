import Link from "next/link";
import type { ContractObligation } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBusinessDateAtNoon } from "@/lib/v9-business-dates";

type ObligationRow = Pick<
  ContractObligation,
  "id" | "title" | "status" | "due_date" | "obligation_type"
> & {
  contracts: { id: string; title: string };
};

function statusTone(status: ContractObligation["status"]): string {
  if (status === "done") return "text-[var(--success-ink)]";
  if (status === "waived") return "text-[var(--text-secondary)]";
  if (status === "in_progress") return "text-[var(--info-ink)]";
  return "text-[var(--warning-ink)]";
}

export function MyObligations({ obligations, embedded = false }: { obligations: ObligationRow[]; embedded?: boolean }) {
  if (obligations.length === 0) {
    if (embedded) {
      return (
        <p className="ui-support-copy rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-3">
          No open obligations assigned to you.
        </p>
      );
    }
    return (
      <section>
        <EmptyState
          eyebrow="Obligations"
          title="No open obligations"
          copy="Contract obligations assigned to you appear here for day-to-day follow-through."
          className="min-h-[200px] md:min-h-[220px]"
        />
      </section>
    );
  }

  return (
    <section className={embedded ? "overflow-hidden rounded-lg border border-[var(--border-subtle)]" : "ui-card overflow-hidden"}>
      <div className={embedded ? "border-b border-[var(--border-subtle)] px-3 py-2" : "ui-surface-tint px-4 py-3.5 md:px-6 md:py-4"}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="ui-section-title">My obligations</h2>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] md:text-[12.5px]">
              Active commitments and due dates
            </p>
          </div>
          <Link href="/contracts/obligations" className="ui-link text-[12.5px] md:text-[12.5px]">
            Full queue
          </Link>
        </div>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {obligations.map((ob) => (
          <li key={ob.id}>
            <Link
              href={`/contracts/${ob.contracts.id}`}
              className="block px-4 py-3.5 transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)] md:px-6 md:py-4"
            >
              <p className="text-[14px] font-semibold text-[var(--text-primary)] md:text-[14px]">{ob.title}</p>
              <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{ob.contracts.title}</p>
              <p className="mt-1 text-[12.5px]">
                <span className={`font-semibold ${statusTone(ob.status)}`}>{ob.status}</span>
                <span className="text-[var(--text-tertiary)]"> · </span>
                <span className="text-[var(--text-secondary)]">{ob.obligation_type}</span>
                {ob.due_date && (
                  <>
                    <span className="text-[var(--text-tertiary)]"> · </span>
                    <span className="text-[var(--text-secondary)]">
                      Due {formatBusinessDateAtNoon(ob.due_date)}
                    </span>
                  </>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
