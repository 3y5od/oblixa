import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertOctagon,
  ChevronRight,
  ListChecks,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { WorkspaceRole } from "@/lib/navigation";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import type { OrgRole } from "@/lib/types";
import { isUuid } from "@/lib/security/validation";
import { compareExceptionsByPriority } from "@/lib/exception-priority";
import { ContractContinuityLinks } from "@/components/ui/contract-continuity-links";
import { EmptyState } from "@/components/ui/empty-state";
import { ExceptionMutationPanels } from "@/components/contracts/exception-mutation-panels";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { PermissionEligibilityHint } from "@/components/ui/permission-eligibility-hint";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCell, type StatTone } from "@/components/ui/stat-cell";
import { StatusPill } from "@/components/ui/status-pill";
import { UiRadioGroup } from "@/components/ui/ui-radio-group";
import { getV10ExceptionResolutionActionOptions } from "@/lib/approval-exception";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";

type StatusFilter = "" | "open" | "in_progress" | "resolved" | "closed";
type SeverityFilter = "" | "low" | "medium" | "high" | "critical";

export const metadata = { title: "Exceptions" };

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_DISPLAY: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const SEVERITY_DISPLAY: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const EXCEPTION_TYPE_DISPLAY: Record<string, string> = {
  missing_critical_field: "Required information missing",
  missing_critical_dates: "Required dates missing",
  approval_sla_breach: "Approval SLA breach",
  obligation_overdue: "Obligation is overdue",
  escalation: "Manager escalation",
  policy_control: "Control breach",
  policy_escalation: "Control escalation",
};

function displayEnumValue(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayExceptionEvent(value: string) {
  const labels: Record<string, string> = {
    detected: "Signal confirmed",
    assigned: "Owner routed",
    resolved: "Recovery closed",
    reopened: "Recovery reopened",
  };
  return labels[value] ?? displayEnumValue(value);
}

function severityTone(severity: string): StatTone {
  if (severity === "critical") return "danger";
  if (severity === "high" || severity === "medium") return "warning";
  return "neutral";
}

function statusTone(status: string): StatTone {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "open") return "warning";
  return "neutral";
}

function severityMedallionClass(severity: string): string {
  if (severity === "critical") {
    return "border-[color:color-mix(in_oklab,var(--danger)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_38%,var(--surface-raised))] text-[var(--danger-ink)]";
  }
  if (severity === "high" || severity === "medium") {
    return "border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_38%,var(--surface-raised))] text-[var(--warning-ink)]";
  }
  return "border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]";
}

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
    .not("contract_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);
  const contractFilter = rawContract && isUuid(rawContract) ? rawContract : null;
  if (contractFilter) query = query.eq("contract_id", contractFilter);

  const [{ data: exceptions }, members] = await Promise.all([
    query,
    loadOrgMemberProfileRows(ctx.admin, ctx.orgId, { limit: 200 }),
  ]);

  const exceptionContractIds = Array.from(
    new Set((exceptions ?? []).map((item) => item.contract_id).filter((id): id is string => Boolean(id)))
  );
  const { data: contracts } =
    exceptionContractIds.length > 0
      ? await ctx.admin
          .from("contracts")
          .select("id, title")
          .eq("organization_id", ctx.orgId)
          .in("id", exceptionContractIds)
          .limit(exceptionContractIds.length)
      : { data: [] };
  const contractById = new Map((contracts ?? []).map((row) => [row.id, row.title]));
  const visibleExceptions = (exceptions ?? []).filter((item) => Boolean(item.contract_id && contractById.has(item.contract_id)));
  const visibleExceptionIds = visibleExceptions.map((item) => item.id);
  const { data: events } =
    visibleExceptionIds.length > 0
      ? await ctx.admin
          .from("exception_events")
          .select("id, exception_id, event_type, created_at")
          .eq("organization_id", ctx.orgId)
          .in("exception_id", visibleExceptionIds)
          .order("created_at", { ascending: false })
          .limit(800)
      : { data: [] };
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
  const orderedExceptions = [...visibleExceptions].sort((a, b) =>
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
  const hasFilters = Boolean(status || severity || contractFilter);

  return (
    <div className="ui-page-stack mx-auto max-w-6xl">
      <DashboardPageHeader
        icon={<ShieldAlert className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Exceptions"
        title="Exception ledger"
        lead="Live system of record for assignment, SLA tracking, and recovery history."
        actions={
          showDecisionsCta ? (
            <Link
              href="/decisions"
              prefetch={false}
              className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Review decisions
              <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
            </Link>
          ) : null
        }
      />

      <section aria-label="Exception summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCell
          label="Open exceptions"
          display={String(actionableExceptions.length)}
          isZero={actionableExceptions.length === 0}
          tone="warning"
          context={
            actionableExceptions.length === 0
              ? "Ledger is clear"
              : `${actionableExceptions.length === 1 ? "1 entry needs" : `${actionableExceptions.length} entries need`} action`
          }
        />
        <StatCell
          label="Critical"
          display={String(criticalActiveCount)}
          isZero={criticalActiveCount === 0}
          tone="danger"
          context={criticalActiveCount === 0 ? "No critical severity" : "Active critical severity"}
        />
        <StatCell
          label="Unassigned"
          display={String(unassignedActiveCount)}
          isZero={unassignedActiveCount === 0}
          tone="warning"
          context={unassignedActiveCount === 0 ? "All owners routed" : "Still need an owner"}
        />
        <StatCell
          label="Past due"
          display={String(overdueActiveCount)}
          isZero={overdueActiveCount === 0}
          tone="danger"
          context={overdueActiveCount === 0 ? "Target dates intact" : "Target date elapsed"}
        />
      </section>

      <section className="ui-card overflow-hidden p-0">
        <SectionHeader
          eyebrow="Filters"
          trailing={
            hasFilters ? (
              <Link
                href="/contracts/exceptions"
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                Clear filters
              </Link>
            ) : null
          }
        />
        <form action="/contracts/exceptions" method="get" className="px-5 py-4">
          <select aria-hidden className="sr-only" tabIndex={-1} defaultValue="">
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Status
              </p>
              <UiRadioGroup
                name="status"
                defaultValue={status}
                ariaLabel="Exception status"
                options={STATUS_FILTERS}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-[4.5rem] shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Severity
              </p>
              <UiRadioGroup
                name="severity"
                defaultValue={severity}
                ariaLabel="Exception severity"
                options={SEVERITY_FILTERS}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
            <button
              type="submit"
              className="ui-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              Apply filters
            </button>
          </div>
        </form>
      </section>

      <section className="ui-card overflow-hidden p-0">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
              Ledger entries
            </p>
            <h2 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
              Exceptions in scope
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              State, owners, and recovery actions visible in one place — not buried in freeform notes.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {status !== "open" && actionableExceptions.length > 0 ? (
              <Link
                href="/contracts/exceptions?status=open"
                className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
              >
                Show open only
                <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              <ListChecks className="h-3 w-3" strokeWidth={1.85} aria-hidden />
              {orderedExceptions.length} {orderedExceptions.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </header>

        {!canEdit ? (
          <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] px-5 py-3">
            <PermissionEligibilityHint
              variant="not_permitted"
              actionLabel="Workspace roles"
              actionHref="/settings"
            />
          </div>
        ) : null}

        {orderedExceptions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              eyebrow="Ledger status"
              title="No exceptions match this ledger"
              copy={
                hasFilters
                  ? "Adjust the filters above or clear the current view to keep active contract exceptions visible."
                  : "No contract exceptions are in scope right now."
              }
              action={
                <>
                  <Link href="/contracts/exceptions" className="ui-btn-primary px-4 py-2 text-[12.5px]">
                    Clear filters
                  </Link>
                  <Link href="/work" className="ui-btn-secondary px-4 py-2 text-[12.5px]">
                    Review unified work
                  </Link>
                </>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
            {orderedExceptions.map((item) => {
              const history = eventsByException.get(item.id) ?? [];
              const ownerLabel = item.owner_id ? ownerLabelById.get(item.owner_id) ?? "Assigned" : "Unassigned";
              const ageLabel = formatDistanceToNowStrict(new Date(item.updated_at), { addSuffix: true });
              const contractTitle = item.contract_id ? contractById.get(item.contract_id) ?? null : null;
              const showAssign = canEdit && (item.status === "open" || item.status === "in_progress");
              const showResolve = canEdit && (item.status === "open" || item.status === "in_progress");
              const showReopen = canEdit && (item.status === "resolved" || item.status === "closed");
              const statusLabel = STATUS_DISPLAY[item.status] ?? displayEnumValue(item.status);
              const severityLabel = SEVERITY_DISPLAY[item.severity] ?? displayEnumValue(item.severity);
              const issueLabel = EXCEPTION_TYPE_DISPLAY[item.exception_type] ?? displayEnumValue(item.exception_type);
              const isActive = item.status === "open" || item.status === "in_progress";
              const recommendedAction = !item.owner_id
                ? "Needs owner"
                : isActive && !item.due_date
                  ? "Needs target date"
                  : item.status === "open"
                    ? "Ready to start"
                    : item.status === "in_progress"
                      ? "Ready to close"
                      : showReopen
                        ? "Can reopen"
                        : "Fixed";
              const nextStep = recommendedAction;
              const eventGroups = new Map<string, { label: string; count: number; latest: string }>();
              for (const evt of history) {
                const label = displayExceptionEvent(evt.event_type);
                const existing = eventGroups.get(evt.event_type);
                if (existing) {
                  existing.count += 1;
                } else {
                  eventGroups.set(evt.event_type, { label, count: 1, latest: evt.created_at });
                }
              }
              const eventSummary = Array.from(eventGroups.values()).slice(0, 3);
              const sevTone = severityTone(item.severity);
              const stTone = statusTone(item.status);
              const dueDateOverdue =
                Boolean(item.due_date) && String(item.due_date) < todayIso && isActive;

              return (
                <li key={item.id} className="px-5 py-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${severityMedallionClass(item.severity)}`}
                        aria-hidden
                      >
                        <AlertOctagon className="h-4 w-4" strokeWidth={1.85} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                            {issueLabel}
                          </h3>
                          <StatusPill tone={sevTone}>{severityLabel}</StatusPill>
                          <StatusPill tone={stTone}>{statusLabel}</StatusPill>
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                          Cause: {issueLabel}
                        </p>
                        {item.contract_id && contractTitle ? (
                          <div className="mt-2">
                            <Link
                              href={`/contracts/${item.contract_id}`}
                              className="ui-link inline-flex items-center gap-1 text-[12.5px] font-semibold"
                            >
                              {contractTitle}
                              <ChevronRight className="h-3 w-3 opacity-70" aria-hidden />
                            </Link>
                            <ContractContinuityLinks
                              contractId={item.contract_id}
                              omit={["exceptions"]}
                              className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-tertiary)]"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <dl className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-1.5 text-[11px] lg:max-w-[20rem] lg:justify-end">
                      <div className="inline-flex items-center gap-1.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          Owner
                        </dt>
                        <dd className={`font-medium ${item.owner_id ? "text-[var(--text-secondary)]" : "text-[var(--warning-ink)]"}`}>
                          {ownerLabel}
                        </dd>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          Target
                        </dt>
                        <dd className={`font-mono ${dueDateOverdue ? "text-[var(--danger-ink)]" : "text-[var(--text-secondary)]"}`}>
                          {item.due_date ?? "Not set"}
                        </dd>
                      </div>
                      <div className="inline-flex items-center gap-1.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          Updated
                        </dt>
                        <dd className="font-medium text-[var(--text-secondary)]">{ageLabel}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
                    <p className="inline-flex items-center gap-1.5 text-[12.5px]">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                        Next action
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">{nextStep}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {eventSummary.length > 0 ? (
                        eventSummary.map((evt) => (
                          <span
                            key={evt.label}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,var(--surface-raised))] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                          >
                            <span className="font-semibold text-[var(--text-primary)]">{evt.label}</span>
                            <span className="font-mono text-[var(--text-tertiary)]">
                              {evt.count}× {new Date(evt.latest).toLocaleDateString()}
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
                          No movement yet
                        </span>
                      )}
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="mt-4">
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
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
