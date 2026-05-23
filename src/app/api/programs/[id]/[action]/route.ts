import { jsonForbidden, jsonNotFound, jsonOk, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { applyProgramToContract } from "@/lib/v4/execution-engine";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { rejectInvalidRouteParamEnums, rejectUnsafeRouteParams } from "@/lib/security/route-params";

const ROUTE = "/api/programs/[id]/[action]";
const PROGRAM_ACTIONS = ["publish", "preview-impact", "apply"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/programs/[id]/[action]",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonForbidden(ROUTE);
  }

  const { id, action } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ id, action }, ["id", "action"], "/api/programs/[id]/[action]");

  if (routeParamRejection) return routeParamRejection;
  const routeActionRejection = rejectInvalidRouteParamEnums({ action }, { action: PROGRAM_ACTIONS }, ROUTE);
  if (routeActionRejection) return routeActionRejection;
  const { data: program } = await ctx.admin
    .from("contract_programs")
    .select("id, organization_id, name, current_version_id, state")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!program) return jsonNotFound(ROUTE);

  if (action === "publish") {
    const { data: latestVersion } = await ctx.admin
      .from("contract_program_versions")
      .select("id, state")
      .eq("organization_id", ctx.orgId)
      .eq("program_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestVersion) {
      return jsonProblem(400, {
        error: "Create a version before publishing.",
        code: "program_version_required",
        diagnostic_id: "program_publish_version_required",
        route: ROUTE,
      });
    }

    if (program.state === "published" && program.current_version_id === latestVersion.id && latestVersion.state === "published") {
      return jsonOk({ ok: true, publishedVersionId: latestVersion.id, alreadyPublished: true });
    }

    const publishedAt = new Date().toISOString();
    const { data: publishedVersion, error: versionError } = await ctx.admin
      .from("contract_program_versions")
      .update({ state: "published", published_at: publishedAt, published_by: ctx.userId })
      .eq("id", latestVersion.id)
      .eq("organization_id", ctx.orgId)
      .eq("state", "draft")
      .select("id, state")
      .maybeSingle();
    if (versionError) {
      return jsonProblem(400, {
        error: "Failed to publish program version",
        code: "program_version_publish_failed",
        diagnostic_id: "program_version_publish_failed",
        route: ROUTE,
      });
    }
    if (!publishedVersion) {
      return jsonProblem(409, {
        error: "Program version status changed before publish",
        code: "program_publish_stale_status",
        diagnostic_id: "program_publish_stale_status",
        route: ROUTE,
      });
    }

    const { data: publishedProgram, error } = await ctx.admin
      .from("contract_programs")
      .update({ state: "published", current_version_id: latestVersion.id })
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .select("id, state, current_version_id")
      .maybeSingle();
    if (error) {
      return jsonProblem(400, {
        error: "Failed to publish program",
        code: "program_publish_failed",
        diagnostic_id: "program_publish_failed",
        route: ROUTE,
      });
    }
    if (!publishedProgram) return jsonNotFound(ROUTE);

    await ctx.admin.from("audit_events").insert({
      organization_id: ctx.orgId,
      user_id: ctx.userId,
      action: "program.published",
      details: { program_id: id, version_id: latestVersion.id },
    });
    return jsonOk({ ok: true, publishedVersionId: latestVersion.id });
  }

  if (action === "preview-impact") {
    const [{ count: contractCount }, { count: activeAssignments }, { data: latestVersion }] = await Promise.all([
      ctx.admin
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId),
      ctx.admin
        .from("contract_program_assignments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.orgId)
        .eq("program_id", id)
        .eq("status", "active"),
      ctx.admin
        .from("contract_program_versions")
        .select("id, version_number, definition_json")
        .eq("organization_id", ctx.orgId)
        .eq("program_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const definition = (latestVersion?.definition_json as Record<string, unknown> | null) ?? {};
    const taskBundles = Array.isArray(definition.taskBundles) ? definition.taskBundles.length : 0;
    const obligationBundles = Array.isArray(definition.obligationBundles)
      ? definition.obligationBundles.length
      : 0;
    const approvalSequences = Array.isArray(definition.approvalSequences)
      ? definition.approvalSequences.length
      : 0;
    const renewalCheckpoints = Array.isArray(definition.renewalCheckpoints)
      ? definition.renewalCheckpoints.length
      : 0;
    return jsonOk({
      impactPreview: {
        latestVersion: latestVersion?.version_number ?? null,
        potentiallyEligibleContracts: contractCount ?? 0,
        currentlyAssignedContracts: activeAssignments ?? 0,
        generatedPerContract: {
          tasks: taskBundles,
          obligations: obligationBundles,
          approvals: approvalSequences,
          renewalCheckpoints,
          estimatedExecutionEdges:
            taskBundles * approvalSequences +
            obligationBundles * approvalSequences +
            renewalCheckpoints * taskBundles,
        },
      },
    });
  }

  if (action === "apply") {
    const _lb_payload = await readJsonBodyLimited(request);
  if (!_lb_payload.ok) return _lb_payload.response;
  const payload = (_lb_payload.body ?? {}) as { contractIds?: string[] };
    const rawContractIds = Array.isArray(payload.contractIds) ? payload.contractIds : [];
    const contractIds = [...new Set(rawContractIds.map((value) => String(value ?? "").trim()).filter(Boolean))];
    if (contractIds.length === 0) {
      return jsonProblem(400, {
        error: "contractIds is required",
        code: "contract_ids_required",
        diagnostic_id: "program_apply_contract_ids_required",
        route: ROUTE,
      });
    }
    if (contractIds.length > 200) {
      return jsonProblem(400, {
        error: "Too many contracts",
        code: "too_many_contracts",
        diagnostic_id: "program_apply_too_many_contracts",
        route: ROUTE,
      });
    }

    const { data: existingContracts, error: contractLookupError } = await ctx.admin
      .from("contracts")
      .select("id")
      .eq("organization_id", ctx.orgId)
      .in("id", contractIds);
    if (contractLookupError) {
      return jsonProblem(400, {
        error: "Failed to look up contracts",
        code: "contract_lookup_failed",
        diagnostic_id: "program_apply_contract_lookup_failed",
        route: ROUTE,
      });
    }
    const existingContractIds = new Set((existingContracts ?? []).map((row) => String(row.id)));
    const invalidContractIds = contractIds.filter((contractId) => !existingContractIds.has(contractId));
    if (invalidContractIds.length > 0) {
      return jsonProblem(400, {
        error: "Some contractIds are invalid for this organization",
        code: "invalid_contract_ids",
        diagnostic_id: "program_apply_invalid_contract_ids",
        route: ROUTE,
        details: { invalidContractIds },
      });
    }

    const { data: latestVersion } = await ctx.admin
      .from("contract_program_versions")
      .select("id")
      .eq("organization_id", ctx.orgId)
      .eq("program_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const rows = contractIds.map((contractId) => ({
      organization_id: ctx.orgId,
      contract_id: contractId,
      program_id: id,
      program_version_id: latestVersion?.id ?? null,
      assignment_mode: "manual",
      status: "active",
      assigned_by: ctx.userId,
    }));

    const { data: assignments, error } = await ctx.admin.from("contract_program_assignments").upsert(rows, {
      onConflict: "contract_id,program_id,status",
      ignoreDuplicates: false,
    }).select("id, contract_id");
    if (error) {
      return jsonProblem(400, {
        error: "Failed to apply program",
        code: "program_apply_failed",
        diagnostic_id: "program_apply_failed",
        route: ROUTE,
      });
    }

    let generatedTotals = { tasks: 0, obligations: 0, approvals: 0, renewals: 0, edges: 0 };
    for (const assignment of assignments ?? []) {
      const generated = await applyProgramToContract({
        admin: ctx.admin,
        organizationId: ctx.orgId,
        contractId: String(assignment.contract_id),
        programId: id,
        assignmentId: String(assignment.id),
        versionId: latestVersion?.id ?? null,
        actorUserId: ctx.userId,
      });
      generatedTotals = {
        tasks: generatedTotals.tasks + generated.tasks,
        obligations: generatedTotals.obligations + generated.obligations,
        approvals: generatedTotals.approvals + generated.approvals,
        renewals: generatedTotals.renewals + generated.renewals,
        edges: generatedTotals.edges + generated.edges,
      };
    }

    for (const contractId of contractIds) {
      await appendCasefileEvent({
        admin: ctx.admin,
        organizationId: ctx.orgId,
        contractId,
        eventType: "program.applied",
        entityType: "contract_program",
        entityId: id,
        actorUserId: ctx.userId,
        details: { program_name: program.name },
      });
    }
    return jsonOk({
      ok: true,
      appliedContracts: contractIds.length,
      generated: generatedTotals,
    });
  }

  return jsonNotFound(ROUTE);
}
