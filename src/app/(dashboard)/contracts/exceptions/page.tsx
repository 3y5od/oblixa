import { getAuthContext } from "@/lib/supabase/server";
import { canEditContracts } from "@/lib/permissions";
import type { WorkspaceRole } from "@/lib/navigation";
import { isAdvancedModuleHidden, loadProductSurfaceContext } from "@/lib/product-surface";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import type { OrgRole } from "@/lib/types";
import { isUuid } from "@/lib/security/validation";
import { compareExceptionsByPriority } from "@/lib/exception-priority";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getV10ExceptionResolutionActionOptions } from "@/lib/approval-exception";
import { loadOrgMemberProfileRows, orgMemberProfileLabel } from "@/lib/org-member-profiles";
import {
  parseSeverityFilter,
  parseStatusFilter,
} from "@/app/(dashboard)/contracts/exceptions/exceptions-page-config";
import { ExceptionsPageView } from "@/app/(dashboard)/contracts/exceptions/exceptions-page-view";
import type {
  ExceptionEvent,
  ExceptionRow,
  OwnerOption,
} from "@/app/(dashboard)/contracts/exceptions/exceptions-page-types";

export const metadata = { title: "Issues" };

export default async function ExceptionsPage(props: {
  searchParams: Promise<{ status?: string; severity?: string; contract?: string }>;
}) {
  const { status: rawStatus, severity: rawSeverity, contract: rawContract } = await props.searchParams;
  const status = parseStatusFilter(rawStatus);
  const severity = parseSeverityFilter(rawSeverity);

  const ctx = await getAuthContext();
  if (!ctx) {
    return (
      <WorkspaceRequiredState
        title="Workspace required for issues"
        message="Issue ownership, target dates, and recovery actions only render inside a workspace. Refresh this page, then ask a workspace admin to restore access if the issue list still stays unavailable."
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

  const [{ data: exceptionRows }, members] = await Promise.all([
    query,
    loadOrgMemberProfileRows(ctx.admin, ctx.orgId, { limit: 200 }),
  ]);
  const exceptions = (exceptionRows ?? []) as ExceptionRow[];
  const exceptionContractIds = Array.from(
    new Set(exceptions.map((item) => item.contract_id).filter((id): id is string => Boolean(id)))
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
  const visibleExceptions = exceptions.filter((item) =>
    Boolean(item.contract_id && contractById.has(item.contract_id))
  );
  const visibleExceptionIds = visibleExceptions.map((item) => item.id);
  const { data: eventRows } =
    visibleExceptionIds.length > 0
      ? await ctx.admin
          .from("exception_events")
          .select("id, exception_id, event_type, created_at")
          .eq("organization_id", ctx.orgId)
          .in("exception_id", visibleExceptionIds)
          .order("created_at", { ascending: false })
          .limit(800)
      : { data: [] };

  const eventsByException = new Map<string, ExceptionEvent[]>();
  for (const row of (eventRows ?? []) as Array<ExceptionEvent & { exception_id: string }>) {
    const group = eventsByException.get(row.exception_id) ?? [];
    group.push({ event_type: row.event_type, created_at: row.created_at });
    eventsByException.set(row.exception_id, group);
  }

  const ownerOptions: OwnerOption[] = (members ?? []).map((row) => ({
    id: row.user_id,
    label: orgMemberProfileLabel(row.profiles),
  }));
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

  return (
    <ExceptionsPageView
      actionableCount={actionableExceptions.length}
      canEdit={canEdit}
      contractById={contractById}
      contractFilter={contractFilter}
      criticalActiveCount={criticalActiveCount}
      eventsByException={eventsByException}
      orderedExceptions={orderedExceptions}
      overdueActiveCount={overdueActiveCount}
      ownerLabelById={ownerLabelById}
      ownerOptions={ownerOptions}
      resolutionActionOptions={resolutionActionOptions}
      severity={severity}
      showDecisionsCta={showDecisionsCta}
      status={status}
      todayIso={todayIso}
      unassignedActiveCount={unassignedActiveCount}
    />
  );
}
