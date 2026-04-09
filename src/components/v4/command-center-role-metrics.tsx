import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";

export async function CommandCenterRoleMetrics(props: { orgId: string; role: WorkspaceRole }) {
  const admin = await createAdminClient();
  const nowIso = new Date().toISOString();

  const [
    { count: exceptionOpen },
    { count: approvalsPending },
    { count: approvalsBreached },
    { count: tasksActive },
    { count: obligationsActive },
  ] = await Promise.all([
    admin
      .from("exceptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .in("status", ["open", "in_progress"]),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .eq("status", "pending"),
    admin
      .from("contract_approvals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lt("due_at", nowIso),
    admin
      .from("contract_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .in("status", ["open", "in_progress", "blocked"]),
    admin
      .from("contract_obligations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", props.orgId)
      .in("status", ["open", "in_progress"]),
  ]);

  const cards = [
    { label: "Open exceptions", value: exceptionOpen ?? 0, href: "/contracts/exceptions" },
    { label: "Pending approvals", value: approvalsPending ?? 0, href: "/contracts/approvals" },
    { label: "Approvals past due", value: approvalsBreached ?? 0, href: "/contracts/approvals/workload" },
    { label: "Active tasks", value: tasksActive ?? 0, href: "/work" },
    { label: "Active obligations", value: obligationsActive ?? 0, href: "/contracts/obligations" },
  ];

  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">
          Live execution metrics · {props.role.replace(/_/g, " ")} lens
        </h2>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-zinc-200 p-3 transition-colors hover:border-zinc-400"
          >
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{c.value}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
