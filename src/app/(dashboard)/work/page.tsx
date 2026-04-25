/**
 * product-surface policy §9.1 — Work hub unifies execution queues (tasks, obligations, approvals, exceptions)
 * without duplicating Renewals / Review / Evidence as primary-only destinations (those stay first-class in nav).
 */
import Link from "next/link";
import {
  AlertOctagon,
  ClipboardList,
  LayoutList,
  ListChecks,
  Stamp,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/navigation";
import {
  isAdvancedModuleHidden,
  loadProductSurfaceContext,
  resolveWorkflowDestination,
} from "@/lib/product-surface";
import { blockerCountForEntity } from "@/components/v4/execution-edge-blockers";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { EmptyState } from "@/components/ui/empty-state";
import { QueueItemCard } from "@/components/ui/queue-item-card";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import type { SemanticStatus } from "@/components/ui/status-badge";
import { surfaceTestIds } from "@/lib/qa/test-ids";
import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { V9_DUE_SOON_DAYS } from "@/lib/v9-business-dates";
import { compareExceptionsByPriority } from "@/lib/exception-priority";
import {
  WORK_HUB_LENS_LABELS,
  WORK_HUB_LENS_VALUES,
  parseWorkHubLens,
  type WorkHubLens,
} from "@/lib/work-hub-lens";
import { WorkQueueInlineActionsGate } from "@/components/work/work-queue-inline-actions-gate";
import { ExceptionMutationPanels } from "@/components/contracts/exception-mutation-panels";

export const metadata = { title: "Work queue" };

function toSemanticStatus(status: string): SemanticStatus {
  if (status === "blocked") return "blocked";
  if (status === "in_progress") return "in_review";
  if (status === "pending") return "warning";
  if (status === "open") return "info";
  return "empty";
}

function lensHref(lens: WorkHubLens) {
  return lens === "assigned" ? "/work" : `/work?lens=${lens}`;
}

type WorkSectionId = "tasks" | "approvals" | "obligations" | "exceptions";

function workSectionHref(lens: WorkHubLens, section: WorkSectionId) {
  return `${lensHref(lens)}#${section}`;
}

/** §12.2 + §20 — distinct recovery CTAs per lens when a queue slice is empty (not one generic link for every lens). */
function tasksEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts", label: "Browse contracts" };
    case "due_soon":
      return { href: "/contracts/renewals?horizon=renewal_30", label: "Open renewals (≤30d)" };
    case "overdue":
      return { href: "/contracts/renewals?horizon=end_30", label: "Open end-date pressure (≤30d)" };
    case "blocked":
      return { href: workSectionHref("blocked", "tasks"), label: "Stay on blocked tasks" };
    case "recent":
      return { href: lensHref("assigned"), label: "Return to open work" };
    default:
      return { href: lensHref("assigned"), label: "Open assigned work" };
  }
}

function obligationsEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts/obligations", label: "Open obligations ledger" };
    case "due_soon":
      return { href: lensHref("assigned"), label: "See all assigned obligations" };
    case "overdue":
      return { href: lensHref("overdue"), label: "Focus overdue lens" };
    case "blocked":
      return { href: lensHref("assigned"), label: "Review assigned obligations" };
    case "recent":
      return { href: lensHref("assigned"), label: "Pick up open obligations" };
    default:
      return { href: lensHref("assigned"), label: "Open assigned work" };
  }
}

function approvalsEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts/approvals?status=pending", label: "Open pending approvals" };
    case "due_soon":
      return { href: "/contracts/approvals?status=pending", label: "Review approval due dates" };
    case "overdue":
      return { href: "/contracts/approvals?status=pending", label: "Clear overdue approvals" };
    case "blocked":
      return { href: "/contracts/approvals", label: "Open approvals workspace" };
    case "recent":
      return { href: "/contracts/approvals", label: "View approvals history" };
    default:
      return { href: "/contracts/approvals?status=pending", label: "Open pending approvals" };
  }
}

function exceptionsEmptyLensAction(lens: WorkHubLens): { href: string; label: string } {
  switch (lens) {
    case "assigned":
      return { href: "/contracts/exceptions?status=open", label: "Open exception ledger" };
    case "due_soon":
      return { href: "/contracts/exceptions?status=open", label: "Prioritize dated exceptions" };
    case "overdue":
      return { href: "/contracts/exceptions?status=open", label: "Triage overdue exceptions" };
    case "blocked":
      return { href: "/contracts/exceptions?status=open", label: "Review open exceptions" };
    case "recent":
      return { href: "/contracts/exceptions?status=resolved", label: "Browse resolved exceptions" };
    default:
      return { href: "/contracts/exceptions?status=open", label: "Open active exception ledger" };
  }
}

export default async function WorkPage(props: {
  searchParams: Promise<{ lens?: string }>;
}) {
  const { lens: rawLens } = await props.searchParams;
  const lens = parseWorkHubLens(rawLens);

  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  const userId = ctx.user.id;

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const workDestination = resolveWorkflowDestination(productSurface, "work");
  const workCopy = workDestination?.visible ? workDestination.copy : null;
  const workQueueMutationsEnabled = canEditContracts(ctx.role as OrgRole);
  const showDecisionsCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "decisions");

  const todayDate = startOfDay(new Date());
  const todayIsoDate = todayDate.toISOString().slice(0, 10);
  const soonDateIso = addDays(todayDate, V9_DUE_SOON_DAYS).toISOString().slice(0, 10);
  const startTodayIso = startOfDay(new Date()).toISOString();
  const endSoonIso = endOfDay(addDays(new Date(), V9_DUE_SOON_DAYS)).toISOString();
  const weekAgoIso = subDays(new Date(), 7).toISOString();

  let tasksQuery = ctx.admin
    .from("contract_tasks")
    .select("id, title, status, due_date, contract_id, blocked_reason, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("assignee_id", userId);

  switch (lens) {
    case "assigned":
      tasksQuery = tasksQuery.in("status", ["open", "in_progress", "blocked"]);
      break;
    case "due_soon":
      tasksQuery = tasksQuery
        .in("status", ["open", "in_progress", "blocked"])
        .not("due_date", "is", null)
        .gte("due_date", todayIsoDate)
        .lte("due_date", soonDateIso);
      break;
    case "overdue":
      tasksQuery = tasksQuery
        .in("status", ["open", "in_progress", "blocked"])
        .not("due_date", "is", null)
        .lt("due_date", todayIsoDate);
      break;
    case "blocked":
      tasksQuery = tasksQuery.eq("status", "blocked");
      break;
    case "recent":
      tasksQuery = tasksQuery.eq("status", "done").gte("updated_at", weekAgoIso);
      break;
    default:
      tasksQuery = tasksQuery.in("status", ["open", "in_progress", "blocked"]);
  }

  let approvalsQuery = ctx.admin
    .from("contract_approvals")
    .select("id, approval_type, status, due_at, contract_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("approver_id", userId);

  switch (lens) {
    case "assigned":
      approvalsQuery = approvalsQuery.eq("status", "pending");
      break;
    case "due_soon":
      approvalsQuery = approvalsQuery
        .eq("status", "pending")
        .not("due_at", "is", null)
        .gte("due_at", startTodayIso)
        .lte("due_at", endSoonIso);
      break;
    case "overdue":
      approvalsQuery = approvalsQuery.eq("status", "pending").not("due_at", "is", null).lt("due_at", startTodayIso);
      break;
    case "recent":
      approvalsQuery = approvalsQuery.eq("status", "approved").gte("updated_at", weekAgoIso);
      break;
    default:
      approvalsQuery = approvalsQuery.eq("status", "pending");
  }

  let obligationsQuery = ctx.admin
    .from("contract_obligations")
    .select("id, title, status, due_date, contract_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("owner_id", userId);

  switch (lens) {
    case "assigned":
      obligationsQuery = obligationsQuery.in("status", ["open", "in_progress"]);
      break;
    case "due_soon":
      obligationsQuery = obligationsQuery
        .in("status", ["open", "in_progress"])
        .not("due_date", "is", null)
        .gte("due_date", todayIsoDate)
        .lte("due_date", soonDateIso);
      break;
    case "overdue":
      obligationsQuery = obligationsQuery
        .in("status", ["open", "in_progress"])
        .not("due_date", "is", null)
        .lt("due_date", todayIsoDate);
      break;
    case "recent":
      obligationsQuery = obligationsQuery.eq("status", "done").gte("updated_at", weekAgoIso);
      break;
    default:
      obligationsQuery = obligationsQuery.in("status", ["open", "in_progress"]);
  }

  let exceptionsQuery = ctx.admin
    .from("exceptions")
    .select("id, title, severity, status, contract_id, owner_id, due_date, updated_at")
    .eq("organization_id", ctx.orgId)
    .or(`owner_id.eq.${userId},owner_id.is.null`);

  switch (lens) {
    case "assigned":
      exceptionsQuery = exceptionsQuery.in("status", ["open", "in_progress"]);
      break;
    case "due_soon":
      exceptionsQuery = exceptionsQuery
        .in("status", ["open", "in_progress"])
        .not("due_date", "is", null)
        .gte("due_date", todayIsoDate)
        .lte("due_date", soonDateIso);
      break;
    case "overdue":
      exceptionsQuery = exceptionsQuery
        .in("status", ["open", "in_progress"])
        .not("due_date", "is", null)
        .lt("due_date", todayIsoDate);
      break;
    case "recent":
      exceptionsQuery = exceptionsQuery.eq("status", "resolved").gte("updated_at", weekAgoIso);
      break;
    default:
      exceptionsQuery = exceptionsQuery.in("status", ["open", "in_progress"]);
  }

  const emptyRows = Promise.resolve({ data: [] as Record<string, unknown>[], error: null });
  const recentFirst = { ascending: false as const };

  const membersPromise = ctx.admin
    .from("organization_members")
    .select("user_id, profiles(full_name, email)")
    .eq("organization_id", ctx.orgId)
    .limit(200);

  let tasksRes;
  let approvalsRes;
  let obligationsRes;
  let exceptionsRes;
  let membersRes;
  if (lens === "assigned") {
    const [{ data: snapshot }, memberRows] = await Promise.all([
      ctx.admin.rpc("work_hub_snapshot", {
        p_org_id: ctx.orgId,
        p_user_id: userId,
        p_limit: 12,
      }),
      membersPromise,
    ]);
    const snap = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
    tasksRes = { data: Array.isArray(snap.tasks) ? snap.tasks : [] };
    approvalsRes = { data: Array.isArray(snap.approvals) ? snap.approvals : [] };
    obligationsRes = { data: Array.isArray(snap.obligations) ? snap.obligations : [] };
    exceptionsRes = { data: Array.isArray(snap.exceptions) ? snap.exceptions : [] };
    membersRes = memberRows;
  } else {
    [tasksRes, approvalsRes, obligationsRes, exceptionsRes, membersRes] = await Promise.all([
      tasksQuery
        .order(lens === "recent" ? "updated_at" : "due_date", lens === "recent" ? recentFirst : { ascending: true })
        .limit(12),
      lens === "blocked"
        ? emptyRows
        : approvalsQuery
            .order(lens === "recent" ? "updated_at" : "due_at", lens === "recent" ? recentFirst : { ascending: true })
            .limit(12),
      lens === "blocked"
        ? emptyRows
        : obligationsQuery
            .order(lens === "recent" ? "updated_at" : "due_date", lens === "recent" ? recentFirst : { ascending: true })
            .limit(12),
      exceptionsQuery.limit(24),
      membersPromise,
    ]);
  }

  const tasks = tasksRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const obligations = obligationsRes.data ?? [];
  const exceptions = (exceptionsRes.data ?? []).sort((a, b) =>
    compareExceptionsByPriority(
      {
        status: String(a.status ?? ""),
        severity: (a.severity as string | null) ?? null,
        due_date: (a.due_date as string | null) ?? null,
        updated_at: String(a.updated_at ?? ""),
      },
      {
        status: String(b.status ?? ""),
        severity: (b.severity as string | null) ?? null,
        due_date: (b.due_date as string | null) ?? null,
        updated_at: String(b.updated_at ?? ""),
      }
    )
  );
  const ownerOptions = (membersRes.data ?? []).map((row) => {
    const profile = row.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return {
      id: String(row.user_id),
      label: profile?.full_name || profile?.email || "Member",
    };
  });
  const ownerLabelById = new Map(ownerOptions.map((owner) => [owner.id, owner.label]));

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

  const tasksEmptyCta = tasksEmptyLensAction(lens);
  const approvalsEmptyCta = approvalsEmptyLensAction(lens);
  const obligationsEmptyCta = obligationsEmptyLensAction(lens);
  const exceptionsEmptyCta = exceptionsEmptyLensAction(lens);

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <h1 className="ui-display-title">Work Queue</h1>
          <p className="ui-page-lead mt-2">
            {workCopy?.headerLead ??
              "Assigned queues, due work, escalation pressure, and the fastest route into your execution backlog."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link href={workSectionHref(lens, "tasks")} className="ui-link">
              Tasks queue
            </Link>
            <Link href={workSectionHref(lens, "approvals")} className="ui-link">
              Approvals queue
            </Link>
            <Link href={workSectionHref(lens, "obligations")} className="ui-link">
              Obligations queue
            </Link>
          </div>
          <nav aria-label="Work lenses" className="ui-segmented -ml-1 mt-4 inline-flex max-w-full flex-wrap gap-2">
            {WORK_HUB_LENS_VALUES.map((key) => (
              <Link
                key={key}
                href={lensHref(key)}
                className={`ui-segmented-item ${lens === key ? "ui-segmented-item-active" : ""}`.trim()}
              >
                {WORK_HUB_LENS_LABELS[key]}
              </Link>
            ))}
          </nav>
          <p className="ui-support-copy mt-3 max-w-2xl">
            Lens: <span className="font-medium text-[var(--text-primary)]">{WORK_HUB_LENS_LABELS[lens]}</span>
          </p>
        </div>
      </header>

      {showDecisionsCta ? (
        <div className="ui-status-panel ui-status-panel-info text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Decisions</span>
          {" — "}
          Escalate items that need a recorded decision path.{" "}
          <Link href="/decisions" prefetch={false} className="ui-link">
            Open decisions
          </Link>
        </div>
      ) : null}

      <section data-testid={surfaceTestIds.workPageSummary} className="ui-page-shell space-y-4">
        <div>
          <p className="ui-eyebrow">Workload</p>
          <h2 className="ui-page-title mt-2 text-[1.8rem]">Queue summary</h2>
          <p className="ui-section-lead mt-2">
            Personal workload, sign-off pressure, obligations, and exception severity in one strip.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-10">
          <OperationalSummaryCard
            eyebrow="Assigned"
            headline="Open items"
            tone={totalQueue > 0 ? "neutral" : "healthy"}
            icon={LayoutList}
            primaryValue={totalQueue}
            primaryUnit="across queues"
            action={{ href: lensHref(lens), label: "View current lens" }}
            variant="compact"
            className="lg:col-span-2 2xl:col-span-2"
          />
          <OperationalSummaryCard
            eyebrow="Execution"
            headline="Tasks"
            tone={tasks.length > 0 ? "attention" : "healthy"}
            icon={ClipboardList}
            primaryValue={tasks.length}
            primaryUnit="assigned to you"
            action={{ href: workSectionHref(lens, "tasks"), label: "Open tasks" }}
            variant="compact"
            className="lg:col-span-1 2xl:col-span-2"
          />
          <OperationalSummaryCard
            eyebrow="Sign-off"
            headline="Approvals"
            tone={approvals.length > 0 ? "attention" : "healthy"}
            icon={Stamp}
            primaryValue={approvals.length}
            primaryUnit="pending"
            action={{ href: workSectionHref(lens, "approvals"), label: "Open approvals" }}
            variant="compact"
            className="lg:col-span-1 2xl:col-span-2"
          />
          <OperationalSummaryCard
            eyebrow="Commitments"
            headline="Obligations"
            tone={obligations.length > 0 ? "neutral" : "healthy"}
            icon={ListChecks}
            primaryValue={obligations.length}
            primaryUnit="open"
            action={{ href: workSectionHref(lens, "obligations"), label: "Open obligations" }}
            variant="compact"
            className="lg:col-span-1 2xl:col-span-2"
          />
          <OperationalSummaryCard
            eyebrow="Risk"
            headline="Critical exceptions"
            tone={criticalExceptions > 0 ? "risk" : "healthy"}
            icon={AlertOctagon}
            primaryValue={criticalExceptions}
            primaryUnit="severity critical"
            action={{ href: workSectionHref(lens, "exceptions"), label: "Open exceptions" }}
            variant="compact"
            className="lg:col-span-1 2xl:col-span-2"
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div id="tasks" className="ui-page-shell p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="ui-eyebrow">Tasks</p>
              <h2 className="ui-section-title mt-1 text-[1.1rem]">Your tasks</h2>
            </div>
            <Link href={workSectionHref(lens, "tasks")} className="ui-link text-xs">
              Open queue
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {tasks.length === 0 ? (
              <li>
                <EmptyState
                  title="No tasks in this lens"
                  copy={`No task rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  action={
                    <Link href={tasksEmptyCta.href} prefetch={false} className="ui-btn-secondary px-4 py-2 text-[13px]">
                      {tasksEmptyCta.label}
                    </Link>
                  }
                />
              </li>
            ) : (
              tasks.map((row) => {
                const blockers = blockerCountForEntity(edges, "task", row.id as string);
                const reason =
                  typeof row.blocked_reason === "string" && row.blocked_reason.trim().length > 0
                    ? row.blocked_reason.trim()
                    : null;
                const meta =
                  row.status === "blocked" && reason
                    ? reason
                    : blockers > 0
                      ? `Blocked by ${blockers} upstream dependenc${blockers === 1 ? "y" : "ies"}`
                      : undefined;
                return (
                  <li key={row.id}>
                    <QueueItemCard
                      objectType="Task"
                      title={row.title}
                      statusLabel={row.status.replace(/_/g, " ")}
                      statusTone={toSemanticStatus(row.status)}
                      owner="You"
                      due={row.due_date ?? undefined}
                      meta={meta}
                      continuityContractId={row.contract_id ?? undefined}
                      continuityOmit={row.contract_id ? ["work", "tasks"] : undefined}
                      actions={
                        <>
                          <WorkQueueInlineActionsGate
                            kind="task"
                            itemId={String(row.id)}
                            status={row.status as "open" | "in_progress" | "blocked" | "done"}
                            mutationsEnabled={workQueueMutationsEnabled}
                            blockerHref={
                              row.status === "blocked"
                                ? row.contract_id
                                  ? `/contracts/${row.contract_id}`
                                  : "/contracts/tasks"
                                : undefined
                            }
                            blockerLabel={row.status === "blocked" ? "Resolve blocker" : undefined}
                          />
                          {row.contract_id ? (
                            <div className="mt-2">
                              <Link
                                href={`/contracts/${row.contract_id}?tab=overview#contract-evidence`}
                                className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]"
                              >
                                Request evidence
                              </Link>
                            </div>
                          ) : null}
                        </>
                      }
                      nextAction={{
                        label: row.contract_id ? "Review contract record" : "Review task details",
                        href: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts/tasks",
                      }}
                    />
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div id="approvals" className="ui-page-shell p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="ui-eyebrow">Approvals</p>
              <h2 className="ui-section-title mt-1 text-[1.1rem]">Your approvals</h2>
            </div>
            <Link href={workSectionHref(lens, "approvals")} className="ui-link text-xs">
              Open queue
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {approvals.length === 0 ? (
              <li>
                <EmptyState
                  title="No approvals in this lens"
                  copy={`No approval rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  action={
                    <Link
                      href={approvalsEmptyCta.href}
                      prefetch={false}
                      className="ui-btn-secondary px-4 py-2 text-[13px]"
                    >
                      {approvalsEmptyCta.label}
                    </Link>
                  }
                />
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
                        ? `Blocked by ${blockerCountForEntity(edges, "approval", row.id as string)} upstream dependenc${blockerCountForEntity(edges, "approval", row.id as string) === 1 ? "y" : "ies"}`
                        : undefined
                    }
                    continuityContractId={row.contract_id ?? undefined}
                    continuityOmit={row.contract_id ? ["work"] : undefined}
                    actions={
                      <>
                        <WorkQueueInlineActionsGate
                          kind="approval"
                          itemId={String(row.id)}
                          status={row.status as "pending" | "approved" | "rejected"}
                          mutationsEnabled={workQueueMutationsEnabled}
                          blockerHref={
                            blockerCountForEntity(edges, "approval", row.id as string) > 0
                              ? row.contract_id
                                ? `/contracts/${row.contract_id}`
                                : "/contracts/approvals"
                              : undefined
                          }
                          blockerLabel={
                            blockerCountForEntity(edges, "approval", row.id as string) > 0
                              ? "Review blocker"
                              : undefined
                          }
                        />
                        {row.contract_id ? (
                          <div className="mt-2">
                            <Link
                              href={`/contracts/${row.contract_id}?tab=overview#contract-evidence`}
                              className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]"
                            >
                              Request evidence
                            </Link>
                          </div>
                        ) : null}
                      </>
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

        <div id="obligations" className="ui-page-shell p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="ui-eyebrow">Obligations</p>
              <h2 className="ui-section-title mt-1 text-[1.1rem]">Your obligations</h2>
            </div>
            <Link href={workSectionHref(lens, "obligations")} className="ui-link text-xs">
              Open queue
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {obligations.length === 0 ? (
              <li>
                <EmptyState
                  title="No obligations in this lens"
                  copy={`No obligation rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  action={
                    <Link
                      href={obligationsEmptyCta.href}
                      prefetch={false}
                      className="ui-btn-secondary px-4 py-2 text-[13px]"
                    >
                      {obligationsEmptyCta.label}
                    </Link>
                  }
                />
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
                        ? `Blocked by ${blockerCountForEntity(edges, "obligation", row.id as string)} upstream dependenc${blockerCountForEntity(edges, "obligation", row.id as string) === 1 ? "y" : "ies"}`
                        : undefined
                    }
                    continuityContractId={row.contract_id ?? undefined}
                    continuityOmit={row.contract_id ? ["work", "obligations"] : undefined}
                    actions={
                      <>
                        <WorkQueueInlineActionsGate
                          kind="obligation"
                          itemId={String(row.id)}
                          status={row.status as "open" | "in_progress" | "done" | "waived"}
                          mutationsEnabled={workQueueMutationsEnabled}
                          blockerHref={
                            blockerCountForEntity(edges, "obligation", row.id as string) > 0
                              ? row.contract_id
                                ? `/contracts/${row.contract_id}`
                                : "/contracts/obligations"
                              : undefined
                          }
                          blockerLabel={
                            blockerCountForEntity(edges, "obligation", row.id as string) > 0
                              ? "Review blocker"
                              : undefined
                          }
                        />
                        {row.contract_id ? (
                          <div className="mt-2">
                            <Link
                              href={`/contracts/${row.contract_id}?tab=overview#contract-evidence`}
                              className="ui-btn-secondary inline-flex px-2.5 py-1 text-[11px]"
                            >
                              Request evidence
                            </Link>
                          </div>
                        ) : null}
                      </>
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

        <div id="exceptions" className="ui-page-shell p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="ui-eyebrow">Exceptions</p>
              <h2 className="ui-section-title mt-1 text-[1.1rem]">Exceptions queue</h2>
            </div>
            <Link href="/contracts/exceptions?status=open" className="ui-link text-xs">
              Open ledger
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {exceptions.length === 0 ? (
              <li>
                <EmptyState
                  title="No exceptions in this lens"
                  copy={`No exception rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  action={
                    <Link
                      href={exceptionsEmptyCta.href}
                      prefetch={false}
                      className="ui-btn-secondary px-4 py-2 text-[13px]"
                    >
                      {exceptionsEmptyCta.label}
                    </Link>
                  }
                />
              </li>
            ) : (
              exceptions.map((row) => (
                <li key={row.id}>
                  <QueueItemCard
                    objectType="Exception"
                    title={row.title}
                    statusLabel={`${row.status} · ${row.severity}`}
                    statusTone={row.severity === "critical" ? "critical" : row.severity === "high" ? "warning" : "info"}
                    owner={row.owner_id ? ownerLabelById.get(String(row.owner_id)) ?? "Assigned" : "Unassigned"}
                    due={row.due_date ?? undefined}
                    meta={!row.owner_id ? "Needs owner" : undefined}
                    continuityContractId={row.contract_id ?? undefined}
                    continuityOmit={row.contract_id ? ["work", "exceptions"] : undefined}
                    actions={
                      workQueueMutationsEnabled ? (
                        <ExceptionMutationPanels
                          exceptionId={String(row.id)}
                          ownerId={(row.owner_id as string | null) ?? null}
                          dueDate={(row.due_date as string | null) ?? null}
                          ownerOptions={ownerOptions}
                          canAssign={row.status === "open" || row.status === "in_progress"}
                          canResolve={row.status === "open" || row.status === "in_progress"}
                          canReopen={row.status === "resolved" || row.status === "closed"}
                        />
                      ) : null
                    }
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
