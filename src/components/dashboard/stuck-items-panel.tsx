import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { AlertOctagon, ChevronRight } from "lucide-react";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";

interface StuckItemsPanelProps {
  orgId: string;
}

export async function StuckItemsPanel({ orgId }: StuckItemsPanelProps) {
  const admin = await getDashboardAdminClientCached();

  const [tasksRes, exceptionsRes] = await Promise.all([
    admin
      .from("contract_tasks")
      .select("id, title, status, updated_at, contracts!inner(id, title)")
      .eq("organization_id", orgId)
      .eq("status", "blocked")
      .order("updated_at", { ascending: true })
      .limit(5),
    admin
      .from("exceptions")
      .select("id, title, status, updated_at, contract_id")
      .eq("organization_id", orgId)
      .eq("status", "blocked")
      .order("updated_at", { ascending: true })
      .limit(5),
  ]);

  type Row = {
    id: string;
    title: string;
    href: string;
    age: number;
    kind: "task" | "exception";
    contractTitle: string;
  };

  const rows: Row[] = [];
  for (const t of (tasksRes.data ?? []) as Array<{
    id: string;
    title: string;
    updated_at: string | null;
    contracts: { id: string; title: string } | { id: string; title: string }[];
  }>) {
    const updated = t.updated_at ? new Date(t.updated_at) : null;
    const age = updated && isValid(updated) ? differenceInDays(new Date(), updated) : 0;
    const contract = Array.isArray(t.contracts) ? t.contracts[0] : t.contracts;
    if (!contract) continue;
    rows.push({
      id: `task-${t.id}`,
      title: t.title,
      href: `/contracts/${contract.id}#task-${t.id}`,
      age,
      kind: "task",
      contractTitle: contract.title,
    });
  }
  for (const e of (exceptionsRes.data ?? []) as Array<{
    id: string;
    title: string;
    updated_at: string | null;
    contract_id: string | null;
  }>) {
    if (!e.contract_id) continue;
    const updated = e.updated_at ? new Date(e.updated_at) : null;
    const age = updated && isValid(updated) ? differenceInDays(new Date(), updated) : 0;
    rows.push({
      id: `exception-${e.id}`,
      title: e.title,
      href: `/contracts/exceptions?contract=${e.contract_id}`,
      age,
      kind: "exception",
      contractTitle: "",
    });
  }

  if (rows.length === 0) return null;

  // Oldest first
  rows.sort((a, b) => b.age - a.age);

  return (
    <section className="space-y-3" aria-label="Stuck items">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <AlertOctagon className="h-4 w-4 text-[var(--danger-ink)]" strokeWidth={1.85} aria-hidden />
        Stuck items
      </h2>
      <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)]">
        {rows.slice(0, 5).map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:color-mix(in_oklab,var(--danger-soft)_18%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--danger-soft)_18%,transparent)] focus-visible:outline-none"
            >
              <span
                aria-hidden
                className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger-ink)]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                  {row.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">
                  {row.kind === "task" ? `Blocked task · ${row.contractTitle}` : "Blocked exception"} ·{" "}
                  {row.age === 0 ? "today" : `${row.age}d`}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100"
                strokeWidth={1.85}
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
