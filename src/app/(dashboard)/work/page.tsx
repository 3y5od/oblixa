import Link from "next/link";
import {
  AlertOctagon,
  ClipboardList,
  LayoutList,
  ListChecks,
  Stamp,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { blockerCountForEntity } from "@/components/v4/execution-edge-blockers";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { QueueItemCard } from "@/components/ui/queue-item-card";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { SemanticStatus } from "@/components/ui/status-badge";

function toSemanticStatus(status: string): SemanticStatus {
  if (status === "blocked") return "blocked";
  if (status === "in_progress") return "in_review";
  if (status === "pending") return "warning";
  if (status === "open") return "info";
  return "empty";
}

export default async function WorkPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const userId = ctx.user.id;

  const [tasksRes, approvalsRes, obligationsRes, exceptionsRes] = await Promise.all([
    ctx.admin
      .from("contract_tasks")
      .select("id, title, status, due_date, contract_id")
      .eq("organization_id", ctx.orgId)
      .eq("assignee_id", userId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_date", { ascending: true })
      .limit(12),
    ctx.admin
      .from("contract_approvals")
      .select("id, approval_type, status, due_at, contract_id")
      .eq("organization_id", ctx.orgId)
      .eq("status", "pending")
      .eq("approver_id", userId)
      .order("due_at", { ascending: true })
      .limit(12),
    ctx.admin
      .from("contract_obligations")
      .select("id, title, status, due_date, contract_id")
      .eq("organization_id", ctx.orgId)
      .in("status", ["open", "in_progress"])
      .eq("owner_id", userId)
      .order("due_date", { ascending: true })
      .limit(12),
    ctx.admin
      .from("exceptions")
      .select("id, title, severity, status, contract_id, owner_id")
      .eq("organization_id", ctx.orgId)
      .in("status", ["open", "in_progress"])
      .or(`owner_id.eq.${userId},owner_id.is.null`)
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const tasks = tasksRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const obligations = obligationsRes.data ?? [];
  const exceptions = exceptionsRes.data ?? [];

  const contractIdSet = new Set<string>();
  for (const r of tasks) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  for (const r of approvals) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  for (const r of obligations) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  for (const r of exceptions) if (r.contract_id) contractIdSet.add(r.contract_id as string);
  const contractIds = [...contractIdSet];

  type EdgeRow = {
    from_entity_type: string;
    from_entity_id: string;
    to_entity_type: string;
    to_entity_id: string;
    relation_type: string;
    status: string;
  };
  const { data: edgeRows } =
    contractIds.length === 0
      ? { data: [] as EdgeRow[] }
      : await ctx.admin
          .from("execution_graph_edges")
          .select("from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, status")
          .eq("organization_id", ctx.orgId)
          .eq("status", "active")
          .in("contract_id", contractIds);
  const edges: EdgeRow[] = (edgeRows ?? []) as EdgeRow[];
  const totalQueue = tasks.length + approvals.length + obligations.length + exceptions.length;
  const criticalExceptions = exceptions.filter((row) => row.severity === "critical").length;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Workflows</p>
          <h1 className="ui-display-title mt-2">Work Queue</h1>
          <p className="ui-muted-tight mt-2">Assigned queues, due work, and escalation pressure.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link href="/contracts/tasks" className="ui-link">
              Tasks queue
            </Link>
            <Link href="/contracts/approvals" className="ui-link">
              Approvals queue
            </Link>
            <Link href="/contracts/obligations" className="ui-link">
              Obligations queue
            </Link>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div>
          <p className="ui-eyebrow">Workload</p>
          <h2 className="ui-section-title mt-2 text-xl">Queue summary</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <OperationalSummaryCard
            eyebrow="Assigned"
            headline="Open items"
            tone={totalQueue > 0 ? "neutral" : "healthy"}
            icon={LayoutList}
            primaryValue={totalQueue}
            primaryUnit="across queues"
            action={{ href: "/contracts/tasks", label: "View tasks" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Execution"
            headline="Tasks"
            tone={tasks.length > 0 ? "attention" : "healthy"}
            icon={ClipboardList}
            primaryValue={tasks.length}
            primaryUnit="assigned to you"
            action={{ href: "/contracts/tasks", label: "View task queue" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Sign-off"
            headline="Approvals"
            tone={approvals.length > 0 ? "attention" : "healthy"}
            icon={Stamp}
            primaryValue={approvals.length}
            primaryUnit="pending"
            action={{ href: "/contracts/approvals", label: "View approvals" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Commitments"
            headline="Obligations"
            tone={obligations.length > 0 ? "neutral" : "healthy"}
            icon={ListChecks}
            primaryValue={obligations.length}
            primaryUnit="open"
            action={{ href: "/contracts/obligations", label: "View obligations" }}
            variant="compact"
          />
          <OperationalSummaryCard
            eyebrow="Risk"
            headline="Critical exceptions"
            tone={criticalExceptions > 0 ? "risk" : "healthy"}
            icon={AlertOctagon}
            primaryValue={criticalExceptions}
            primaryUnit="severity critical"
            action={{ href: "/contracts/exceptions", label: "View exceptions" }}
            variant="compact"
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Your tasks</h2>
            <Link href="/contracts/tasks" className="ui-link text-xs">
              Open queue
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {tasks.length === 0 ? (
              <li>
                <EmptyState title="No assigned tasks" copy="You have no open or in-progress tasks." />
              </li>
            ) : (
              tasks.map((row) => (
                <li key={row.id}>
                  <QueueItemCard
                    objectType="Task"
                    title={row.title}
                    statusLabel={row.status.replace(/_/g, " ")}
                    statusTone={toSemanticStatus(row.status)}
                    owner="You"
                    due={row.due_date ?? undefined}
                    meta={
                      blockerCountForEntity(edges, "task", row.id as string) > 0
                        ? `Blocked by ${blockerCountForEntity(edges, "task", row.id as string)} upstream`
                        : undefined
                    }
                    nextAction={{
                      label: row.contract_id ? "Review contract record" : "Review task details",
                      href: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts/tasks",
                    }}
                  />
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Your approvals</h2>
            <Link href="/contracts/approvals" className="ui-link text-xs">
              Open queue
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {approvals.length === 0 ? (
              <li>
                <EmptyState title="No pending approvals" copy="You have no approvals waiting for your action." />
              </li>
            ) : (
              approvals.map((row) => (
                <li key={row.id}>
                  <QueueItemCard
                    objectType="Approval"
                    title={row.approval_type}
                    statusLabel={row.status}
                    statusTone={toSemanticStatus(row.status)}
                    owner="You"
                    due={row.due_at ? new Date(row.due_at).toLocaleString() : undefined}
                    meta={
                      blockerCountForEntity(edges, "approval", row.id as string) > 0
                        ? `Blocked by ${blockerCountForEntity(edges, "approval", row.id as string)} upstream`
                        : undefined
                    }
                    nextAction={{
                      label: row.contract_id ? "Review contract record" : "Review approvals queue",
                      href: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts/approvals",
                    }}
                  />
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Your obligations</h2>
            <Link href="/contracts/obligations" className="ui-link text-xs">
              Open queue
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {obligations.length === 0 ? (
              <li>
                <EmptyState title="No active obligations" copy="You have no open obligations assigned to you." />
              </li>
            ) : (
              obligations.map((row) => (
                <li key={row.id}>
                  <QueueItemCard
                    objectType="Obligation"
                    title={row.title}
                    statusLabel={row.status.replace(/_/g, " ")}
                    statusTone={toSemanticStatus(row.status)}
                    owner="You"
                    due={row.due_date ?? undefined}
                    meta={
                      blockerCountForEntity(edges, "obligation", row.id as string) > 0
                        ? `Blocked by ${blockerCountForEntity(edges, "obligation", row.id as string)} upstream`
                        : undefined
                    }
                    nextAction={{
                      label: row.contract_id ? "Review contract record" : "Review obligations queue",
                      href: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts/obligations",
                    }}
                  />
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ui-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="ui-section-title">Exceptions queue</h2>
            <Link href="/contracts/exceptions" className="ui-link text-xs">
              Open ledger
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {exceptions.length === 0 ? (
              <li>
                <EmptyState title="No open exceptions" copy="No exceptions currently assigned to you or unassigned." />
              </li>
            ) : (
              exceptions.map((row) => (
                <li key={row.id}>
                  <QueueItemCard
                    objectType="Exception"
                    title={row.title}
                    statusLabel={`${row.status} · ${row.severity}`}
                    statusTone={row.severity === "critical" ? "critical" : row.severity === "high" ? "warning" : "info"}
                    owner={row.owner_id ? "Assigned" : "Unassigned"}
                    nextAction={{
                      label: row.contract_id ? "Review contract record" : "Review exceptions ledger",
                      href: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts/exceptions",
                    }}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
