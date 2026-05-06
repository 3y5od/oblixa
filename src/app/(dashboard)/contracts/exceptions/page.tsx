import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { WorkspaceRole } from "@/lib/navigation";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import type { OrgRole } from "@/lib/types";
import { isUuid } from "@/lib/security/validation";
import { compareExceptionsByPriority } from "@/lib/exception-priority";
import { OperationalSummaryCard } from "@/components/ui/operational-summary-card";
import { AlertOctagon, CalendarClock, ShieldAlert, UserRound } from "lucide-react";
import { ExceptionMutationPanels } from "@/components/contracts/exception-mutation-panels";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";
import { getV10ExceptionResolutionActionOptions } from "@/lib/v10-approval-exception";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

type StatusFilter = "" | "open" | "in_progress" | "resolved" | "closed";
type SeverityFilter = "" | "low" | "medium" | "high" | "critical";

export const metadata = { title: "Exceptions" };

export default async function ExceptionsPage(props: {
  searchParams: Promise<{ status?: string; severity?: string; contract?: string }>;
}) {
  const { status: rawStatus, severity: rawSeverity, contract: rawContract } = await props.searchParams;
  const status = (["", "open", "in_progress", "resolved", "closed"].includes(rawStatus ?? "")
    ? rawStatus
    : "") as StatusFilter;
  const severity = (["", "low", "medium", "high", "critical"].includes(rawSeverity ?? "")
    ? rawSeverity
    : "") as SeverityFilter;

  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for exceptions"
        message="Exception ownership, SLA tracking, and recovery actions only render inside a workspace. Refresh this page, then ask a workspace admin to restore access if the ledger still stays unavailable."
      />
    );
  }
  const canEdit = canEditContracts(ctx.role as OrgRole);

  const productSurface = await loadProductSurfaceContext(
    ctx.admin,
    ctx.orgId,
    ctx.role as WorkspaceRole
  );
  const showDecisionsCta =
    (productSurface.mode === "advanced" || productSurface.mode === "assurance") &&
    !isAdvancedModuleHidden(productSurface, "decisions");
  const resolutionActionOptions = getV10ExceptionResolutionActionOptions({
    campaignsEnabled: evaluateFeatureEligibility(productSurface, "campaigns", {
      surfaceType: "page",
      surfaceIdentifier: "/contracts/exceptions",
    }).allowed,
    findingsEnabled: evaluateFeatureEligibility(productSurface, "findings", {
      surfaceType: "page",
      surfaceIdentifier: "/contracts/exceptions",
    }).allowed,
  });

  let query = ctx.admin
    .from("exceptions")
    .select("id, contract_id, title, exception_type, severity, status, owner_id, due_date, updated_at")
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);
  const contractFilter = rawContract && isUuid(rawContract) ? rawContract : null;
  if (contractFilter) query = query.eq("contract_id", contractFilter);

  const [{ data: exceptions }, { data: contracts }, { data: events }, members] = await Promise.all([
    query,
    ctx.admin.from("contracts").select("id, title").eq("organization_id", ctx.orgId).limit(500),
    ctx.admin
      .from("exception_events")
      .select("id, exception_id, event_type, created_at")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(800),
    loadOrgMemberProfileRows(ctx.admin, ctx.orgId, { limit: 200 }),
  ]);

  const contractById = new Map((contracts ?? []).map((row) => [row.id, row.title]));
  const eventsByException = new Map<string, Array<{ event_type: string; created_at: string }>>();
  for (const row of events ?? []) {
    const group = eventsByException.get(row.exception_id) ?? [];
    group.push({ event_type: row.event_type, created_at: row.created_at });
    eventsByException.set(row.exception_id, group);
  }
  const ownerOptions = (members ?? []).map((row) => {
    return {
      id: row.user_id,
      label: orgMemberProfileLabel(row.profiles),
    };
  });
  const ownerLabelById = new Map(ownerOptions.map((owner) => [owner.id, owner.label]));
  const orderedExceptions = [...(exceptions ?? [])].sort((a, b) =>
    compareExceptionsByPriority(
      {
        status: a.status,
        severity: a.severity,
        due_date: a.due_date,
        updated_at: a.updated_at,
      },
      {
        status: b.status,
        severity: b.severity,
        due_date: b.due_date,
        updated_at: b.updated_at,
      }
    )
  );
  const actionableExceptions = orderedExceptions.filter((item) =>
    ["open", "in_progress"].includes(item.status)
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const criticalActiveCount = actionableExceptions.filter((item) => item.severity === "critical").length;
  const unassignedActiveCount = actionableExceptions.filter((item) => !item.owner_id).length;
  const overdueActiveCount = actionableExceptions.filter(
    (item) => Boolean(item.due_date) && String(item.due_date) < todayIso
  ).length;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header-compact">
        <div>
          <p className="ui-eyebrow">Exceptions</p>
          <h1 className="ui-page-title-compact mt-2">Exception ledger</h1>
          <p className="ui-page-lead mt-3">Live exception system of record with assignment, SLA tracking, and history.</p>
        </div>
      </header>

      {showDecisionsCta ? (
        <div className="ui-status-panel ui-status-panel-info text-sm">
          <span className="font-medium text-[var(--text-primary)]">Decisions</span>
          {" — "}
          When an exception needs an explicit call, open or continue a decision record.{" "}
          <Link href="/decisions" prefetch={false} className="ui-link">
            Review decisions
          </Link>
        </div>
      ) : null}

      <section className="ui-page-shell">
        <div className="mb-4 space-y-1.5">
          <p className="ui-eyebrow">Filters</p>
          <h2 className="ui-section-title">Focus the ledger</h2>
          <p className="ui-support-copy">Narrow by active state or severity when you need to route ownership and recover overdue issues fast.</p>
        </div>
        <form action="/contracts/exceptions" method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <p className="ui-label-caps">Status</p>
            <select name="status" defaultValue={status} className="ui-input">
              <option value="">All</option>
              <option value="open">open</option>
              <option value="in_progress">in progress</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <div>
            <p className="ui-label-caps">Severity</p>
            <select name="severity" defaultValue={severity} className="ui-input">
              <option value="">All</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>
          <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px]">
            Apply filters
          </button>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OperationalSummaryCard
          eyebrow="Active"
          headline="Open exceptions"
          tone={actionableExceptions.length > 0 ? "attention" : "healthy"}
          icon={ShieldAlert}
          primaryValue={actionableExceptions.length}
          primaryUnit="need action"
          action={{ href: "/contracts/exceptions?status=open", label: "Review active exceptions" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Severity"
          headline="Critical issues"
          tone={criticalActiveCount > 0 ? "risk" : "healthy"}
          icon={AlertOctagon}
          primaryValue={criticalActiveCount}
          primaryUnit="active critical"
          action={{ href: "/contracts/exceptions?status=open&severity=critical", label: "Triage critical issues" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="Ownership"
          headline="Unassigned"
          tone={unassignedActiveCount > 0 ? "attention" : "healthy"}
          icon={UserRound}
          primaryValue={unassignedActiveCount}
          primaryUnit="still need owner"
          action={{ href: "/contracts/exceptions?status=open", label: "Assign owners" }}
          variant="compact"
        />
        <OperationalSummaryCard
          eyebrow="SLA"
          headline="Past due"
          tone={overdueActiveCount > 0 ? "risk" : "healthy"}
          icon={CalendarClock}
          primaryValue={overdueActiveCount}
          primaryUnit="need recovery"
          action={{ href: "/contracts/exceptions?status=open", label: "Review overdue" }}
          variant="compact"
        />
      </section>

      <section className="ui-page-shell">
        {!canEdit ? (
          <div className="mb-4">
            <PermissionEligibilityHint
              variant="not_permitted"
              actionLabel="Workspace roles"
              actionHref="/settings"
            />
          </div>
        ) : null}
        <p className="ui-label-caps">Ledger entries</p>
        <p className="ui-support-copy mt-1">Keep exception state, owners, and recovery actions visible in one place instead of burying them in freeform notes.</p>
        <ul className="mt-3 space-y-3">
          {(exceptions ?? []).length === 0 ? (
            <li>
              <V10RecoverableState
                state="empty"
                title="No exceptions match this view"
                reason={
                  status || severity || contractFilter
                    ? "The current filters hide active exception work. Clear or widen the ledger filters to keep high-severity issues visible."
                    : "No active or historical exceptions are in scope right now. New exceptions will appear here with ownership, due state, and auditable recovery history."
                }
                accessibleName="No exceptions match this ledger view"
                nextAction={
                  <Link href="/contracts/exceptions" className="ui-btn-secondary px-4 py-2 text-[13px]">
                    Clear filters
                  </Link>
                }
                nextActionLabel="Clear filters"
                density="compact"
              />
            </li>
          ) : (
            orderedExceptions.map((item) => {
              const history = eventsByException.get(item.id) ?? [];
              const ownerLabel = item.owner_id ? ownerLabelById.get(item.owner_id) ?? "Assigned" : "Unassigned";
              const ageLabel = formatDistanceToNowStrict(new Date(item.updated_at), { addSuffix: true });
              const showAssign = canEdit && (item.status === "open" || item.status === "in_progress");
              const showResolve = canEdit && (item.status === "open" || item.status === "in_progress");
              const showReopen = canEdit && (item.status === "resolved" || item.status === "closed");
              const nextStep = !item.owner_id
                ? "Assign an owner and due date before this issue spreads."
                : item.status === "open"
                  ? "Move this exception into progress with a visible owner and recovery date."
                  : item.status === "in_progress"
                    ? "Capture the resolution note so downstream teams know what changed."
                    : "Keep the resolution auditable, or reopen if the issue returned.";
              return (
                <li key={item.id} className="ui-operational-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{item.title}</p>
                    <span className="ui-chip">{item.status}</span>
                    <span className="ui-chip">{item.severity}</span>
                  </div>
                  <p className="ui-support-copy mt-1.5">
                    Cause: {item.exception_type.replace(/_/g, " ")} ·{" "}
                    {item.contract_id ? (
                      <Link href={`/contracts/${item.contract_id}`} className="ui-link">
                        {contractById.get(item.contract_id) ?? item.contract_id}
                      </Link>
                    ) : (
                      "No linked contract"
                    )}
                    {item.due_date ? ` · due ${item.due_date}` : ""}
                    {` · owner ${ownerLabel}`}
                    {` · updated ${ageLabel}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2" role="list">
                    {item.due_date ? (
                      <span className="ui-metric-chip">
                        <span className="ui-meta">Due</span>
                        <span>{item.due_date}</span>
                      </span>
                    ) : null}
                    <span className="ui-metric-chip">
                      <span className="ui-meta">Owner</span>
                      <span>{ownerLabel}</span>
                    </span>
                  </div>
                  <p className="ui-support-copy mt-2 font-medium text-[var(--text-secondary)]">{nextStep}</p>
                  {item.contract_id ? (
                    <ContractContinuityLinks contractId={item.contract_id} omit={["exceptions"]} />
                  ) : null}
                  <p className="ui-support-copy mt-2">
                    Recent events:{" "}
                    {history.slice(0, 4).map((evt) => `${evt.event_type} (${new Date(evt.created_at).toLocaleDateString()})`).join(" · ") ||
                      "none"}
                  </p>
                  {canEdit ? (
                    <ExceptionMutationPanels
                      exceptionId={item.id}
                      ownerId={item.owner_id}
                      dueDate={item.due_date}
                      ownerOptions={ownerOptions}
                      resolutionActionOptions={resolutionActionOptions}
                      canAssign={showAssign}
                      canResolve={showResolve}
                      canReopen={showReopen}
                    />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
