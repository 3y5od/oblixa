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
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { blockerCountForEntity } from "@/components/v4/execution-edge-blockers";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { QueueItemCard } from "@/components/ui/queue-item-card";
import {
  DiagnosticDisclosure,
  OperationalSummaryCard,
} from "@/components/ui/operational-summary-card";
import { V10EmptyStateTelemetryLink } from "@/components/ui/v10-empty-state-telemetry-link";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { surfaceTestIds } from "@/lib/qa/test-ids";
import {
  compareV10WorkReadModelRows,
  v10WorkReadModelMatchesLens,
  type V10WorkReadModelRow,
} from "@/lib/v10-work-semantics";
import { applyV10ReadModelVisibility } from "@/lib/v10-visibility";
import { compareExceptionsByPriority } from "@/lib/exception-priority";
import {
  WORK_HUB_LENS_LABELS,
  WORK_HUB_LENS_VALUES,
  parseWorkHubLens,
} from "@/lib/work-hub-lens";
import { WorkQueueInlineActionsGate } from "@/components/work/work-queue-inline-actions-gate";
import { V10WorkInboxList } from "@/components/work/v10-work-inbox-list";
import { ExceptionMutationPanels } from "@/components/contracts/exception-mutation-panels";
import { V10_WORK_ITEM_TYPES, V10_WORK_LENSES, type V10WorkItemType } from "@/lib/v10-release-contract";
import { getV10WorkItemHref } from "@/lib/v10-job-routing";
import { subDays } from "date-fns";
import { operationalActionLabel } from "@/lib/ui/operational-copy";
import { getV10ExceptionResolutionActionOptions } from "@/lib/v10-approval-exception";
import {
  approvalsEmptyLensAction,
  exceptionsEmptyLensAction,
  lensHref,
  obligationsEmptyLensAction,
  tasksEmptyLensAction,
  toSemanticStatus,
  type V10WorkActionRow,
  v10PrimaryActionHref,
  workSectionHref,
} from "./work-page-helpers";

export const metadata = { title: "Work queue" };
type WorkQueueRow = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
  approval_type?: string;
  blocked_reason?: string | null;
  contract_id?: string | null;
  due_at?: string | null;
  severity?: string | null;
  due_date?: string | null;
  owner_id?: string | null;
  updated_at?: string | null;
};

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
  const resolutionActionOptions = getV10ExceptionResolutionActionOptions({
    campaignsEnabled: evaluateFeatureEligibility(productSurface, "campaigns", {
      surfaceType: "page",
      surfaceIdentifier: "/work",
    }).allowed,
    findingsEnabled: evaluateFeatureEligibility(productSurface, "findings", {
      surfaceType: "page",
      surfaceIdentifier: "/work",
    }).allowed,
  });
  const v10VisibleWorkQuery = applyV10ReadModelVisibility(
    ctx.admin.from("v10_work_items").select("id", { count: "exact", head: true }),
    { organizationId: ctx.orgId, role: ctx.role, workspaceMode: productSurface.mode }
  );
  const v10LensQuery = applyV10ReadModelVisibility(
    ctx.admin
      .from("v10_work_items")
      .select("source_id, type, status, owner_user_id, owner_state, due_state, severity, compatible_action_group, updated_at"),
    { organizationId: ctx.orgId, role: ctx.role, workspaceMode: productSurface.mode }
  );
  const { count: v10VisibleWorkCount, error: v10VisibleWorkCountError } = await v10VisibleWorkQuery;
  const { data: v10LensRows, error: v10LensRowsError } = await v10LensQuery
    .limit(1000);
  let v10WorkQuery = applyV10ReadModelVisibility(
    ctx.admin
      .from("v10_work_items")
      .select("id, source_id, source_table, type, title, status, contract_id, owner_user_id, owner_state, due_at, due_state, priority, severity, blocked_reason, primary_action, secondary_actions, compatible_action_group, last_state_change_at, updated_at"),
    { organizationId: ctx.orgId, role: ctx.role, workspaceMode: productSurface.mode }
  );
  switch (lens) {
    case "assigned":
      v10WorkQuery = v10WorkQuery.eq("owner_user_id", userId).neq("status", "done");
      break;
    case "assigned_to_team":
      v10WorkQuery = v10WorkQuery.not("owner_user_id", "is", null).neq("owner_user_id", userId).neq("owner_state", "unassigned").neq("status", "done");
      break;
    case "unassigned":
      v10WorkQuery = v10WorkQuery.eq("owner_state", "unassigned").neq("status", "done");
      break;
    case "due_today":
      v10WorkQuery = v10WorkQuery.eq("due_state", "due_today").neq("status", "done");
      break;
    case "due_soon":
      v10WorkQuery = v10WorkQuery.eq("due_state", "due_soon").neq("status", "done");
      break;
    case "overdue":
      v10WorkQuery = v10WorkQuery.eq("due_state", "overdue").neq("status", "done");
      break;
    case "blocked":
      v10WorkQuery = v10WorkQuery.eq("status", "blocked");
      break;
    case "high_risk":
      v10WorkQuery = v10WorkQuery
        .or("severity.in.(high,critical),and(due_state.eq.overdue,type.in.(approval,evidence_request,renewal_checkpoint))")
        .neq("status", "done");
      break;
    case "recent":
      v10WorkQuery = v10WorkQuery.eq("status", "done").gte("updated_at", subDays(new Date(), 7).toISOString());
      break;
    case "failed_jobs":
      v10WorkQuery = v10WorkQuery.in("type", ["report_failure", "export_failure", "import_failure", "extraction_failure"]).neq("status", "done");
      break;
    case "automation_approvals":
      v10WorkQuery = v10WorkQuery.eq("type", "automation_approval").neq("status", "done");
      break;
    default:
      v10WorkQuery = v10WorkQuery.neq("status", "done");
  }
  const { data: v10WorkItems, error: v10WorkItemsError } = await v10WorkQuery
    .order(lens === "recent" ? "updated_at" : "due_at", { ascending: lens !== "recent", nullsFirst: false })
    .limit(100);
  const v10WorkReadModelError = v10VisibleWorkCountError ?? v10LensRowsError ?? v10WorkItemsError;
  const sortedV10WorkItems = (v10WorkItems ?? []).slice().sort(compareV10WorkReadModelRows).slice(0, 24);
  const showSourceDiagnostics = true;
  const v10LensCounts = new Map(
    WORK_HUB_LENS_VALUES.map((key) => [
      key,
      (v10LensRows ?? []).filter((item) => v10WorkReadModelMatchesLens(item as V10WorkReadModelRow, userId, key)).length,
    ])
  );
  const compatibleActionGroups = [...new Set(sortedV10WorkItems.map((item) => item.compatible_action_group).filter(Boolean).map(String))];

  const tasksPromise = ctx.admin
    .from("contract_tasks")
    .select("id, title, status, blocked_reason, contract_id, due_date, assignee_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(20);
  const approvalsPromise = ctx.admin
    .from("contract_approvals")
    .select("id, approval_type, status, contract_id, due_at, approver_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("status", "pending")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(20);
  const obligationsPromise = ctx.admin
    .from("contract_obligations")
    .select("id, title, status, contract_id, due_date, owner_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(20);
  const exceptionsPromise = ctx.admin
    .from("exceptions")
    .select("id, title, status, severity, contract_id, due_date, owner_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .neq("status", "resolved")
    .order("updated_at", { ascending: false })
    .limit(20);

  const membersPromise = ctx.admin
    .from("organization_members")
    .select("user_id, profiles(full_name, email)")
    .eq("organization_id", ctx.orgId)
    .limit(200);

  const [tasksRes, approvalsRes, obligationsRes, exceptionsRes, membersRes] = await Promise.all([
    tasksPromise,
    approvalsPromise,
    obligationsPromise,
    exceptionsPromise,
    membersPromise,
  ]);

  const tasks = (tasksRes.data ?? []) as WorkQueueRow[];
  const approvals = (approvalsRes.data ?? []).map((approval) => ({
    ...approval,
    title: `${String(approval.approval_type ?? "Approval")} approval`,
  })) as WorkQueueRow[];
  const obligations = (obligationsRes.data ?? []) as WorkQueueRow[];
  const exceptions = ((exceptionsRes.data ?? []) as WorkQueueRow[]).sort((a, b) =>
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
  const v10WorkListItems = sortedV10WorkItems.map((item) => {
    const href = getV10WorkItemHref({
      type: item.type as V10WorkItemType,
      sourceId: String(item.source_id ?? ""),
      contractId: item.contract_id ?? null,
      primaryAction: item.primary_action,
      fallbackHref: "/work",
    });
    const ownerLabel =
      item.owner_state === "unassigned"
        ? "Unassigned"
        : item.owner_state === "stale"
          ? "Needs reassignment"
          : item.owner_user_id === userId
            ? "You"
            : ownerLabelById.get(String(item.owner_user_id ?? "")) ?? "Assigned teammate";
    const meta =
      item.blocked_reason ??
      (item.owner_state === "stale"
        ? "Assigned owner can no longer act on this work."
        : item.due_state !== "none"
          ? String(item.due_state).replace(/_/g, " ")
          : undefined);
    return {
      key: `${item.source_table}:${item.source_id}:${item.type}`,
      v10WorkItemId: String(item.id),
      sourceId: String(item.source_id),
      sourceTable: String(item.source_table),
      type: String(item.type),
      title: item.title,
      status: String(item.status),
      statusLabel: String(item.status).replace(/_/g, " "),
      statusTone: toSemanticStatus(String(item.status)),
      ownerUserId: item.owner_user_id ?? null,
      ownerLabel,
      ownerState: String(item.owner_state ?? "") || null,
      due: item.due_at ?? undefined,
      meta,
      href,
      contractId: item.contract_id ?? null,
      primaryAction: item.primary_action ?? null,
      nextActionLabel: operationalActionLabel(item.primary_action, "open_contract"),
      nextActionHref: v10PrimaryActionHref(item as V10WorkActionRow, href),
      priorityLabel: String(item.priority ?? "normal").replace(/_/g, " "),
      lastStateChangeAt: item.last_state_change_at ?? null,
      secondaryActionsLabel:
        Array.isArray(item.secondary_actions) && item.secondary_actions.length > 0
          ? item.secondary_actions.map((action) => operationalActionLabel(String(action))).join(", ")
          : "no additional action available",
      compatibleActionGroup: item.compatible_action_group ?? null,
    };
  });

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
          <nav aria-label="Work lenses" className="ui-segmented -ml-1 mt-4 inline-flex max-w-full flex-wrap gap-2">
            {WORK_HUB_LENS_VALUES.map((key) => (
              <Link
                key={key}
                href={lensHref(key)}
                className={`ui-segmented-item ${lens === key ? "ui-segmented-item-active" : ""}`.trim()}
              >
                {WORK_HUB_LENS_LABELS[key]}
                <span className="ml-2 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px]">
                  {v10LensCounts.get(key) ?? 0}
                </span>
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
            Review decisions
          </Link>
        </div>
      ) : null}

      <section className="ui-section-shell-dense text-sm text-[var(--text-secondary)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-medium text-[var(--text-primary)]">Needs action</p>
            <p className="mt-1">
              {v10VisibleWorkCount ?? 0} visible work item
              {(v10VisibleWorkCount ?? 0) === 1 ? "" : "s"} are available for this workspace.
              Risk, deadlines, blockers, and ownership gaps are prioritized before routine work.
            </p>
          </div>
          <Link href="/contracts" className="ui-operational-action shrink-0 text-[11px]">
            Browse contracts
            <span aria-hidden>→</span>
          </Link>
        </div>
        {v10WorkReadModelError ? (
          <V10RecoverableState
            state="partial"
            title="Work data is partially unavailable"
            reason="Work queries returned a partial result for this lens. The visible items can still be reviewed while freshness is restored."
            accessibleName="Work partial data state"
            nextActionLabel="Review workspace health"
            nextAction={
              <Link href="/settings/health" className="ui-link">
                Review workspace health
              </Link>
            }
            className="mt-3"
          />
        ) : null}
        {compatibleActionGroups.length > 0 ? (
          <DiagnosticDisclosure title="Bulk and source diagnostics" className="mt-3">
            <div className="flex flex-wrap gap-2">
              <span className="font-medium text-[var(--text-primary)]">Bulk-compatible groups:</span>
              {compatibleActionGroups.map((group) => (
                <span key={group} className="rounded-full border border-[var(--border-subtle)] px-2 py-1">
                  {group}
                </span>
              ))}
              <span>
                Coverage spans {V10_WORK_LENSES.length} lenses and {V10_WORK_ITEM_TYPES.length} work item types.
              </span>
            </div>
          </DiagnosticDisclosure>
        ) : null}
      </section>

      {sortedV10WorkItems.length > 0 ? (
        <section className="ui-page-shell space-y-4" aria-labelledby="v10-work-index-title">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="ui-eyebrow">Needs action</p>
              <h2 id="v10-work-index-title" className="ui-page-title mt-2 text-[1.6rem]">
                {WORK_HUB_LENS_LABELS[lens]}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                Tasks, approvals, obligations, exceptions, evidence, and recovery work are sorted by urgency,
                blocker state, ownership, and deadline pressure.
              </p>
            </div>
            <Link href="/settings/health" className="ui-link text-sm">
              View workspace health
            </Link>
          </div>
          <V10WorkInboxList
            items={v10WorkListItems}
            ownerOptions={ownerOptions}
            resolutionActionOptions={resolutionActionOptions}
            mutationsEnabled={workQueueMutationsEnabled}
          />
        </section>
      ) : (
        <V10RecoverableState
          state={v10WorkReadModelError ? "partial" : "empty"}
          title={v10WorkReadModelError ? "Work lens is partially unavailable" : "No items in this lens"}
          reason={
            v10WorkReadModelError
              ? "Review workspace health for stale data or failed jobs, then retry this lens."
              : "This lens has no visible work. Switch to another lens or review workspace health if the result looks stale."
          }
          accessibleName={v10WorkReadModelError ? "Work lens partial state" : "Empty Work lens state"}
          surface="work"
          section="primary_lens"
          sourceObject="work_item"
          density={v10WorkReadModelError ? "standard" : "compact"}
          nextActionLabel="Review alternate Work lenses"
          nextAction={
            <>
              <V10EmptyStateTelemetryLink
                href="/work"
                className="ui-link"
                surface="work"
                section="primary_lens"
                sourceObject="work_item"
                actionLabel="Assigned to me"
              >
                Assigned to me
              </V10EmptyStateTelemetryLink>
              <V10EmptyStateTelemetryLink
                href="/work?lens=unassigned"
                className="ui-link"
                surface="work"
                section="primary_lens"
                sourceObject="work_item"
                actionLabel="Unassigned"
              >
                Unassigned
              </V10EmptyStateTelemetryLink>
              <V10EmptyStateTelemetryLink
                href="/work?lens=failed_jobs"
                className="ui-link"
                surface="work"
                section="primary_lens"
                sourceObject="work_item"
                actionLabel="Failed jobs"
              >
                Failed jobs
              </V10EmptyStateTelemetryLink>
              <V10EmptyStateTelemetryLink
                href="/settings/health"
                className="ui-link"
                surface="work"
                section="primary_lens"
                sourceObject="work_item"
                actionLabel="Workspace health"
              >
                Workspace health
              </V10EmptyStateTelemetryLink>
            </>
          }
        />
      )}

      {showSourceDiagnostics ? (
        <DiagnosticDisclosure title="Source queue diagnostics">
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
            action={{ href: lensHref(lens), label: "Review current lens" }}
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
            action={{ href: workSectionHref(lens, "tasks"), label: "Review tasks" }}
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
            action={{ href: workSectionHref(lens, "approvals"), label: "Review approvals" }}
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
            action={{ href: workSectionHref(lens, "obligations"), label: "Review obligations" }}
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
            action={{ href: workSectionHref(lens, "exceptions"), label: "Triage exceptions" }}
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
              Review tasks
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {tasks.length === 0 ? (
              <li>
                <V10RecoverableState
                  state="empty"
                  title="No tasks in this lens"
                  reason={`No task rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  accessibleName="Empty task queue state"
                  nextActionLabel={tasksEmptyCta.label}
                  nextAction={
                    <V10EmptyStateTelemetryLink
                      href={tasksEmptyCta.href}
                      prefetch={false}
                      className="ui-btn-secondary px-4 py-2 text-[13px]"
                      surface="work"
                      section="tasks"
                      sourceObject="contract_task"
                      actionLabel={tasksEmptyCta.label}
                    >
                      {tasksEmptyCta.label}
                    </V10EmptyStateTelemetryLink>
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
              Review approvals
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {approvals.length === 0 ? (
              <li>
                <V10RecoverableState
                  state="empty"
                  title="No approvals in this lens"
                  reason={`No approval rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  accessibleName="Empty approval queue state"
                  nextActionLabel={approvalsEmptyCta.label}
                  nextAction={
                    <V10EmptyStateTelemetryLink
                      href={approvalsEmptyCta.href}
                      prefetch={false}
                      className="ui-btn-secondary px-4 py-2 text-[13px]"
                      surface="work"
                      section="approvals"
                      sourceObject="contract_approval"
                      actionLabel={approvalsEmptyCta.label}
                    >
                      {approvalsEmptyCta.label}
                    </V10EmptyStateTelemetryLink>
                  }
                />
              </li>
            ) : (
              approvals.map((row) => (
                <li key={row.id}>
                  <QueueItemCard
                    objectType="Approval"
                    title={row.approval_type ?? "Approval"}
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
                          status={row.status as "pending" | "approved" | "rejected" | "changes_requested"}
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
              Review obligations
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {obligations.length === 0 ? (
              <li>
                <V10RecoverableState
                  state="empty"
                  title="No obligations in this lens"
                  reason={`No obligation rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  accessibleName="Empty obligation queue state"
                  nextActionLabel={obligationsEmptyCta.label}
                  nextAction={
                    <V10EmptyStateTelemetryLink
                      href={obligationsEmptyCta.href}
                      prefetch={false}
                      className="ui-btn-secondary px-4 py-2 text-[13px]"
                      surface="work"
                      section="obligations"
                      sourceObject="contract_obligation"
                      actionLabel={obligationsEmptyCta.label}
                    >
                      {obligationsEmptyCta.label}
                    </V10EmptyStateTelemetryLink>
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
                <V10RecoverableState
                  state="empty"
                  title="No exceptions in this lens"
                  reason={`No exception rows match the ${WORK_HUB_LENS_LABELS[lens].toLowerCase()} lens right now.`}
                  accessibleName="Empty exception queue state"
                  nextActionLabel={exceptionsEmptyCta.label}
                  nextAction={
                    <V10EmptyStateTelemetryLink
                      href={exceptionsEmptyCta.href}
                      prefetch={false}
                      className="ui-btn-secondary px-4 py-2 text-[13px]"
                      surface="work"
                      section="exceptions"
                      sourceObject="contract_exception"
                      actionLabel={exceptionsEmptyCta.label}
                    >
                      {exceptionsEmptyCta.label}
                    </V10EmptyStateTelemetryLink>
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
                          resolutionActionOptions={resolutionActionOptions}
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
        </DiagnosticDisclosure>
      ) : null}
    </div>
  );
}
