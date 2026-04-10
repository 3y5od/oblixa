import {
  AlertOctagon,
  AlertTriangle,
  ClipboardList,
  ListChecks,
  Stamp,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/navigation";
import { OperationalSectionHeader, OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { OperationalTone } from "@/lib/ui/operational-surface";

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

  const ex = exceptionOpen ?? 0;
  const ap = approvalsPending ?? 0;
  const br = approvalsBreached ?? 0;
  const ta = tasksActive ?? 0;
  const ob = obligationsActive ?? 0;

  const cards: Array<{
    eyebrow: string;
    headline: string;
    tone: OperationalTone;
    icon: typeof AlertOctagon;
    value: number;
    unit: string;
    href: string;
    action: string;
    breakdown?: { label: string; value: string }[];
  }> = [
    {
      eyebrow: "Exceptions",
      headline: "Open exceptions",
      tone: ex > 10 ? "risk" : ex > 0 ? "attention" : "healthy",
      icon: AlertOctagon,
      value: ex,
      unit: "open / in progress",
      href: "/contracts/exceptions",
      action: "View exceptions",
    },
    {
      eyebrow: "Approvals",
      headline: "Pending",
      tone: ap > 0 ? "attention" : "healthy",
      icon: Stamp,
      value: ap,
      unit: "awaiting sign-off",
      href: "/contracts/approvals",
      action: "View approvals",
    },
    {
      eyebrow: "SLA",
      headline: "Past due",
      tone: br > 0 ? "risk" : "healthy",
      icon: AlertTriangle,
      value: br,
      unit: "approvals overdue",
      href: "/contracts/approvals/workload",
      action: "View workload",
    },
    {
      eyebrow: "Execution",
      headline: "Active tasks",
      tone: ta > 0 ? "neutral" : "healthy",
      icon: ClipboardList,
      value: ta,
      unit: "open / blocked",
      href: "/work",
      action: "View work queue",
    },
    {
      eyebrow: "Commitments",
      headline: "Active obligations",
      tone: ob > 0 ? "neutral" : "healthy",
      icon: ListChecks,
      value: ob,
      unit: "open",
      href: "/contracts/obligations",
      action: "View obligations",
    },
  ];

  return (
    <section className="space-y-3">
      <OperationalSectionHeader
        eyebrow="Execution"
        title="Live portfolio metrics"
        description={`Org-wide counts · ${props.role.replace(/_/g, " ")} lens`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <OperationalSummaryCard
            key={c.headline}
            eyebrow={c.eyebrow}
            headline={c.headline}
            tone={c.tone}
            icon={c.icon}
            primaryValue={c.value}
            primaryUnit={c.unit}
            breakdown={c.breakdown}
            action={{ href: c.href, label: c.action }}
            variant="compact"
          />
        ))}
      </div>
    </section>
  );
}
