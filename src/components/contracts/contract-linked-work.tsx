import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";
import { humanizeOperationalToken } from "@/lib/ui/operational-copy";
import { ChipPair } from "@/components/ui/chip-pair";
import { TimeChip } from "@/components/ui/time-chip";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";

type WorkItem = {
  type: string | null;
  status: string | number | null;
  source_id: string | number;
  title: string;
  due_at?: string | null;
  due_state?: string | null;
};

/**
 * Right-rail linked task list. The Open affordance is reserved and revealed
 * on row hover/focus (group-focus-visible) so keyboard users get it too.
 */
export function ContractLinkedWork({ items, contractId }: { items: WorkItem[]; contractId: string }) {
  // Evidence-typed tasks live in the Evidence card — exclude here so the same
  // row isn't double-rendered.
  const linked = items.filter((item) => !String(item.type ?? "").toLowerCase().includes("evidence"));
  const workHref = `/work?contract=${contractId}`;
  return (
    <section className="group/section">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-baseline gap-1.5">
          <p className="ui-caps-3 text-[var(--text-tertiary)]">Linked tasks</p>
          {linked.length > 0 ? <CountChip value={linked.length} /> : null}
        </div>
        {linked.length > 0 ? (
          <Link
            href={workHref}
            className="ui-chip-focus inline-flex items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] opacity-0 transition-opacity group-hover/section:opacity-100 group-focus-within/section:opacity-100"
          >
            Open all
            <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="mt-1.5 border-t border-[var(--border-subtle)]">
        {linked.length === 0 ? (
          <DashboardEmptyState
            icon={ListChecks}
            label="No linked tasks"
            hint="Tracked tasks appear here"
            action={{ href: workHref, label: "Create task" }}
            compact
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {linked.slice(0, 5).map((item) => {
              const statusRaw = String(item.status).toLowerCase();
              // WAITING outranks OPEN: waiting rows render warning so they pull
              // the eye first; in-flight rows stay neutral.
              const chipTone =
                statusRaw === "blocked" || statusRaw === "failed" || statusRaw === "rejected"
                  ? ("warning" as const)
                  : statusRaw === "completed" || statusRaw === "approved"
                    ? ("success" as const)
                    : undefined;
              return (
                <li key={`${item.type}:${item.source_id}`}>
                  <Link
                    href={workHref}
                    className="group/work -mx-1 flex items-start justify-between gap-2 rounded-lg px-1 py-2 outline-none transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_10%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <div className="min-w-0">
                      <p
                        title={item.title}
                        className="line-clamp-2 text-[12px] font-medium leading-snug text-[var(--text-primary)] group-hover/work:text-[var(--accent-strong)]"
                      >
                        {item.title}
                      </p>
                      <span className="mt-1 inline-flex flex-wrap items-center gap-1.5">
                        <ChipPair
                          primary={humanizeOperationalToken(String(item.type))}
                          secondary={humanizeOperationalToken(String(item.status))}
                          tone={chipTone}
                        />
                        {item.due_at ? (
                          <TimeChip
                            date={String(item.due_at)}
                            format="relative"
                            tone={
                              String(item.due_state ?? "").toLowerCase().includes("overdue") ? "danger" : undefined
                            }
                          />
                        ) : null}
                      </span>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-0.5 self-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--accent-strong)] opacity-0 transition-opacity group-hover/work:opacity-100 group-focus-visible/work:opacity-100">
                      Open
                      <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.85} aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
