import Link from "next/link";
import { format } from "date-fns";
import type { ContractObligation } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";

type ObligationRow = Pick<
  ContractObligation,
  "id" | "title" | "status" | "due_date" | "obligation_type"
> & {
  contracts: { id: string; title: string };
};

function statusTone(status: ContractObligation["status"]): string {
  if (status === "done") return "text-emerald-700";
  if (status === "waived") return "text-zinc-600";
  if (status === "in_progress") return "text-blue-700";
  return "text-amber-800";
}

export function MyObligations({ obligations }: { obligations: ObligationRow[] }) {
  if (obligations.length === 0) {
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
    <section className="ui-card overflow-hidden">
      <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-4 py-3.5 md:px-6 md:py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="ui-section-title">My obligations</h2>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] md:text-[12px]">
              Active commitments and due dates
            </p>
          </div>
          <Link href="/contracts/obligations" className="ui-link text-[12px] md:text-[13px]">
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
              <p className="text-[14px] font-semibold text-[var(--text-primary)] md:text-[15px]">{ob.title}</p>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{ob.contracts.title}</p>
              <p className="mt-1 text-[12px]">
                <span className={`font-semibold ${statusTone(ob.status)}`}>{ob.status}</span>
                <span className="text-[var(--text-tertiary)]"> · </span>
                <span className="text-[var(--text-secondary)]">{ob.obligation_type}</span>
                {ob.due_date && (
                  <>
                    <span className="text-[var(--text-tertiary)]"> · </span>
                    <span className="text-[var(--text-secondary)]">
                      Due {format(new Date(`${ob.due_date}T12:00:00`), "MMM d, yyyy")}
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
