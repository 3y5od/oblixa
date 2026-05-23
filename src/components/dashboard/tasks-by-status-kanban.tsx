import Link from "next/link";
import { subDays } from "date-fns";
import { Kanban } from "lucide-react";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";

interface TasksByStatusKanbanProps {
  orgId: string;
}

interface Column {
  label: string;
  count: number;
  href: string;
  tone: "neutral" | "accent" | "warning" | "success";
}

export async function TasksByStatusKanban({ orgId }: TasksByStatusKanbanProps) {
  const admin = await getDashboardAdminClientCached();
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();

  const [openRes, inProgressRes, blockedRes, recentDoneRes] = await Promise.all([
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "open"),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "in_progress"),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "blocked"),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "done")
      .gte("updated_at", sevenDaysAgo),
  ]);

  const columns: Column[] = [
    {
      label: "Open",
      count: openRes.count ?? 0,
      href: "/contracts/tasks?status=open",
      tone: "neutral",
    },
    {
      label: "In progress",
      count: inProgressRes.count ?? 0,
      href: "/contracts/tasks?status=in_progress",
      tone: "accent",
    },
    {
      label: "Blocked",
      count: blockedRes.count ?? 0,
      href: "/contracts/tasks?status=blocked",
      tone: "warning",
    },
    {
      label: "Done 7D",
      count: recentDoneRes.count ?? 0,
      href: "/contracts/tasks?status=done",
      tone: "success",
    },
  ];

  const total = columns.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;

  const max = Math.max(...columns.map((c) => c.count), 1);

  return (
    <section className="space-y-3" aria-label="Tasks by status">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <Kanban className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
        Tasks by status
      </h2>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4 sm:grid-cols-4">
        {columns.map((c) => {
          const ink =
            c.tone === "accent"
              ? "var(--accent-strong)"
              : c.tone === "warning"
                ? "var(--warning-ink)"
                : c.tone === "success"
                  ? "var(--success-ink)"
                  : "var(--text-primary)";
          const widthPct = Math.round((c.count / max) * 100);
          return (
            <Link
              key={c.label}
              href={c.href}
              className="group flex flex-col gap-2 rounded-xl border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-raised)_92%,white)] p-3 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] focus-visible:outline-none"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {c.label}
              </p>
              <p
                className="text-[1.5rem] font-semibold leading-none tabular-nums tracking-[-0.02em]"
                style={{ color: c.count === 0 ? "var(--text-tertiary)" : ink }}
              >
                {c.count}
              </p>
              <span
                aria-hidden
                className="block h-1 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]"
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${widthPct}%`, background: ink }}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
