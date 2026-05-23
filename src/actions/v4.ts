"use server";

import { createClient, createAdminClient, getOrEnsureDeterministicMembership } from "@/lib/supabase/server";
import { hasRoleCapability } from "@/lib/access-control";
import { revalidatePath } from "next/cache";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { applyProgramToContract } from "@/lib/v4/execution-engine";
import { validatePolicyRegistry } from "@/lib/v4/policy-registry";
import { buildRenewalDecisionPacketPayload } from "@/lib/v4/renewal-decision-packet";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { recordV10AuditEvent } from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import {
  ensureProgramsSurfaceAccess,
  ensureReportPackReportTypeAllowed,
} from "@/actions/v4-surface-guards";

async function getContext() {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) return null;

  const { data: settings } = await admin
    .from("organization_workflow_settings")
    .select("organization_id, role_policy_json")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  return {
    admin,
    userId: user.id,
    orgId: membership.organization_id,
    role: membership.role,
    rolePolicyJson: (settings?.role_policy_json as Record<string, unknown> | null) ?? null,
  };
}

function deny() {
  return { error: "Access denied" as const };
}

export async function createProgramAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const surfaceGate = await ensureProgramsSurfaceAccess(ctx);
  if (surfaceGate) return surfaceGate;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Name is required" as const };

  const { data, error } = await ctx.admin
    .from("contract_programs")
    .insert({
      organization_id: ctx.orgId,
      name,
      description: description || null,
      created_by: ctx.userId,
      state: "draft",
    })
    .select("id, name, state")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/programs");
  return { success: true as const, program: data };
}

export async function publishProgramAction(programId: string) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const surfaceGate = await ensureProgramsSurfaceAccess(ctx);
  if (surfaceGate) return surfaceGate;

  const { data: latestVersion } = await ctx.admin
    .from("contract_program_versions")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("program_id", programId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestVersion) return { error: "Create a version before publishing." as const };

  const { error } = await ctx.admin
    .from("contract_programs")
    .update({ state: "published", current_version_id: latestVersion.id })
    .eq("id", programId)
    .eq("organization_id", ctx.orgId);
  if (error) return { error: mapDataSourceError(error.message) };

  const { error: versionError } = await ctx.admin
    .from("contract_program_versions")
    .update({ state: "published", published_at: new Date().toISOString(), published_by: ctx.userId })
    .eq("id", latestVersion.id)
    .eq("organization_id", ctx.orgId);
  if (versionError) return { error: mapDataSourceError(versionError.message) };
  revalidatePath("/contracts/programs");
  return { success: true as const };
}

export async function applyProgramAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const surfaceGate = await ensureProgramsSurfaceAccess(ctx);
  if (surfaceGate) return surfaceGate;
  const programId = String(formData.get("programId") ?? "").trim();
  const contractIdsRaw = String(formData.get("contractIds") ?? "");
  const contractIds = contractIdsRaw
    .split(/[\n,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  if (!programId || contractIds.length === 0) {
    return { error: "programId and at least one contract id are required" as const };
  }
  const { data: latestVersion } = await ctx.admin
    .from("contract_program_versions")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("program_id", programId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestVersion) {
    return { error: "Program must have at least one published version before applying." as const };
  }
  const rows = contractIds.map((contractId) => ({
    organization_id: ctx.orgId,
    contract_id: contractId,
    program_id: programId,
    program_version_id: latestVersion.id,
    assignment_mode: "manual",
    status: "active",
    assigned_by: ctx.userId,
  }));
  const { data: assignments, error } = await ctx.admin
    .from("contract_program_assignments")
    .upsert(rows, { onConflict: "contract_id,program_id,status", ignoreDuplicates: false })
    .select("id, contract_id");
  if (error) return { error: mapDataSourceError(error.message) };

  for (const assignment of assignments ?? []) {
    await applyProgramToContract({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: String(assignment.contract_id),
      programId,
      assignmentId: String(assignment.id),
      versionId: latestVersion.id,
      actorUserId: ctx.userId,
    });
    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: String(assignment.contract_id),
      eventType: "program.applied",
      entityType: "contract_program",
      entityId: programId,
      actorUserId: ctx.userId,
    });
  }
  revalidatePath("/contracts/programs");
  revalidatePath("/contracts/execution-graph");
  return { success: true as const, appliedContracts: assignments?.length ?? 0 };
}

export async function createExceptionAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "maintenance_manage",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }

  const contractId = String(formData.get("contractId") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const exceptionType = String(formData.get("exceptionType") ?? "").trim() || "manual_exception";
  if (!title) return { error: "Title is required" as const };

  const { data, error } = await ctx.admin
    .from("exceptions")
    .insert({
      organization_id: ctx.orgId,
      contract_id: contractId,
      title,
      exception_type: exceptionType,
      severity: String(formData.get("severity") ?? "medium"),
      status: "open",
      root_cause: String(formData.get("rootCause") ?? "").trim() || null,
    })
    .select("id, title, status, severity")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };
  return { success: true as const, exception: data };
}

export async function createReportPackAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }

  const name = String(formData.get("name") ?? "").trim();
  const reportType = String(formData.get("reportType") ?? "").trim() || "weekly_execution_health";
  if (!name) return { error: "Name is required" as const };
  const typeGate = await ensureReportPackReportTypeAllowed(ctx, reportType);
  if (typeGate) return typeGate;
  const emitWebhooks = formData.get("emitWebhooks") === "on" || formData.get("emitWebhooks") === "true";

  const { data, error } = await ctx.admin
    .from("report_packs")
    .insert({
      organization_id: ctx.orgId,
      name,
      report_type: reportType,
      schedule: String(formData.get("schedule") ?? "").trim() || null,
      created_by: ctx.userId,
      config_json: {},
      delivery_json: emitWebhooks ? { emit_webhooks: true } : {},
      active: true,
    })
    .select("id, name, report_type, active")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/reports");
  revalidatePath("/contracts/reports");
  return { success: true as const, reportPack: data };
}

export async function saveProgramVersionDefinitionAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const surfaceGate = await ensureProgramsSurfaceAccess(ctx);
  if (surfaceGate) return surfaceGate;
  const programId = String(formData.get("programId") ?? "").trim();
  const rawJson = String(formData.get("definitionJson") ?? "").trim();
  if (!programId || !rawJson) return { error: "programId and definition JSON are required" as const };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return { error: "Invalid JSON" as const };
  }

  const { data: last } = await ctx.admin
    .from("contract_program_versions")
    .select("version_number")
    .eq("organization_id", ctx.orgId)
    .eq("program_id", programId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (last?.version_number ?? 0) + 1;

  const { error } = await ctx.admin.from("contract_program_versions").insert({
    organization_id: ctx.orgId,
    program_id: programId,
    version_number: nextVersion,
    state: "draft",
    definition_json: parsed,
    changelog: String(formData.get("changelog") ?? "").trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/programs");
  return { success: true as const };
}

export async function updateProgramRoutingAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const surfaceGate = await ensureProgramsSurfaceAccess(ctx);
  if (surfaceGate) return surfaceGate;
  const programId = String(formData.get("programId") ?? "").trim();
  const autoRulesRaw = String(formData.get("autoAssignmentRulesJson") ?? "").trim();
  const defaultRoutingRaw = String(formData.get("defaultRoutingJson") ?? "").trim();
  if (!programId) return { error: "programId is required" as const };
  let autoAssignmentRules: unknown = [];
  let defaultRoutingJson: Record<string, unknown> = {};
  if (autoRulesRaw) {
    try {
      autoAssignmentRules = JSON.parse(autoRulesRaw);
    } catch {
      return { error: "autoAssignmentRulesJson must be valid JSON" as const };
    }
  }
  if (defaultRoutingRaw) {
    try {
      defaultRoutingJson = JSON.parse(defaultRoutingRaw) as Record<string, unknown>;
    } catch {
      return { error: "defaultRoutingJson must be valid JSON" as const };
    }
  }
  const { error } = await ctx.admin
    .from("contract_programs")
    .update({
      auto_assignment_rules: autoAssignmentRules,
      default_routing_json: defaultRoutingJson,
    })
    .eq("id", programId)
    .eq("organization_id", ctx.orgId);
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/programs");
  return { success: true as const };
}

export async function updateProgramAssignmentOverrideFormAction(formData: FormData): Promise<void> {
  const r = await updateProgramAssignmentOverrideAction(formData);
  if (r && "error" in r && r.error) {
    console.error("[v4] updateProgramAssignmentOverrideAction", r.error);
  }
}

export async function updateProgramAssignmentOverrideAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const surfaceGate = await ensureProgramsSurfaceAccess(ctx);
  if (surfaceGate) return surfaceGate;
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const raw = String(formData.get("overrideJson") ?? "").trim();
  if (!assignmentId) return { error: "assignmentId is required" as const };
  let overrideJson: Record<string, unknown> = {};
  if (raw) {
    try {
      overrideJson = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { error: "overrideJson must be valid JSON" as const };
    }
  }
  const { error } = await ctx.admin
    .from("contract_program_assignments")
    .update({ override_json: overrideJson })
    .eq("id", assignmentId)
    .eq("organization_id", ctx.orgId);
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/programs");
  revalidatePath("/contracts");
  return { success: true as const };
}

export async function submitEvidenceNoteAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const requirementId = String(formData.get("requirementId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!requirementId) return { error: "requirementId is required" as const };
  if (!note) return { error: "Note is required" as const };

  const { data: requirement } = await ctx.admin
    .from("evidence_requirements")
    .select("id, contract_id, status")
    .eq("id", requirementId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!requirement) return { error: "Requirement not found" as const };

  const { error: subErr } = await ctx.admin.from("evidence_submissions").insert({
    organization_id: ctx.orgId,
    requirement_id: requirementId,
    submitted_by: ctx.userId,
    status: "submitted",
    payload_json: { note },
  });
  if (subErr) return { error: mapDataSourceError(subErr.message) };

  await ctx.admin
    .from("evidence_requirements")
    .update({ status: "submitted" })
    .eq("id", requirementId)
    .eq("organization_id", ctx.orgId);

  const cid = requirement.contract_id as string | null;
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.userId,
    contractId: cid,
    action:
      requirement.status === "rejected"
        ? "product.v9.evidence_resubmitted"
        : "product.v9.evidence_submitted",
    details: { requirementId },
  });
  await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: requirement.status === "rejected" ? "evidence_request.resubmitted" : "evidence_request.submitted",
    targetType: "evidence_request",
    targetId: requirementId,
    contractId: cid,
    outcome: "success",
    beforeStateHash: String(requirement.status),
    afterStateHash: "submitted",
    safeMetadata: { note_state: "provided" },
  });
  await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
    refreshScope: cid ? "one_contract" : "one_model",
    contractId: cid ?? undefined,
    reason: "evidence_submission_action",
    modelKeys: [
      "work_items",
      "contract_health_snapshots",
      "contract_activity_events",
      "evidence_request_statuses",
      "external_evidence_submissions",
      "audit_events",
      "command_search_index",
    ],
  });
  revalidatePath("/contracts");
  if (cid) revalidatePath(`/contracts/${cid}`);
  return {
    success:
      requirement.status === "rejected"
        ? "Evidence resubmitted. Reviewer guidance stays visible until the new submission is reviewed."
        : "Evidence submitted. Reviewers can now confirm whether the linked work item can clear.",
  } as const;
}

export async function createEvidenceTemplateAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const name = String(formData.get("name") ?? "").trim();
  const requirementType = String(formData.get("requirementType") ?? "document").trim();
  const templateRaw = String(formData.get("templateJson") ?? "").trim() || "{}";
  if (!name) return { error: "Name is required" as const };
  let templateJson: Record<string, unknown> = {};
  try {
    templateJson = JSON.parse(templateRaw) as Record<string, unknown>;
  } catch {
    return { error: "templateJson must be valid JSON" as const };
  }
  const { error } = await ctx.admin.from("evidence_requirement_templates").insert({
    organization_id: ctx.orgId,
    name,
    requirement_type: requirementType,
    template_json: templateJson,
    created_by: ctx.userId,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/evidence-studio");
  return { success: true as const };
}

export async function savePolicyRegistryAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (ctx.role !== "admin") return deny();
  const raw = String(formData.get("registryJson") ?? "").trim();
  if (!raw) return { error: "registry JSON is required" as const };
  let registry: unknown;
  try {
    registry = JSON.parse(raw);
  } catch {
    return { error: "Invalid JSON" as const };
  }
  if (!Array.isArray(registry)) {
    return { error: "Policy registry must be a JSON array" as const };
  }
  const validated = validatePolicyRegistry(registry);
  if (!validated.ok) {
    return { error: validated.error as string };
  }
  const { error } = await ctx.admin.from("organization_workflow_settings").upsert(
    {
      organization_id: ctx.orgId,
      v4_policy_registry_json: registry,
      created_by: ctx.userId,
    },
    { onConflict: "organization_id", ignoreDuplicates: false }
  );
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/settings/policy");
  revalidatePath("/settings/policy/registry");
  revalidatePath("/settings/policy/diagnostics");
  return { success: true as const };
}

export async function saveReportPackAnnotationsAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const packId = String(formData.get("reportPackId") ?? "").trim();
  const raw = String(formData.get("annotationsJson") ?? "").trim() || "[]";
  if (!packId) return { error: "reportPackId is required" as const };

  const { data: packRow } = await ctx.admin
    .from("report_packs")
    .select("report_type")
    .eq("id", packId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!packRow) return { error: "Report pack not found" as const };
  const annTypeGate = await ensureReportPackReportTypeAllowed(ctx, String(packRow.report_type ?? ""));
  if (annTypeGate) return annTypeGate;

  let annotations: unknown;
  try {
    annotations = JSON.parse(raw);
  } catch {
    return { error: "annotations must be valid JSON array" as const };
  }
  if (!Array.isArray(annotations)) return { error: "annotations must be a JSON array" as const };
  const { error } = await ctx.admin
    .from("report_packs")
    .update({ annotations_json: annotations })
    .eq("id", packId)
    .eq("organization_id", ctx.orgId);
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/reports");
  return { success: true as const };
}

export async function createReportPackSubscriptionAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const packId = String(formData.get("reportPackId") ?? "").trim();
  const audience = String(formData.get("audienceLabel") ?? "").trim() || "Primary";
  const cron = String(formData.get("scheduleCron") ?? "").trim() || null;
  const emailsRaw = String(formData.get("recipientEmails") ?? "").trim();
  const emails = emailsRaw
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  if (!packId) return { error: "reportPackId is required" as const };

  const { data: subPack } = await ctx.admin
    .from("report_packs")
    .select("report_type")
    .eq("id", packId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!subPack) return { error: "Report pack not found" as const };
  const subTypeGate = await ensureReportPackReportTypeAllowed(ctx, String(subPack.report_type ?? ""));
  if (subTypeGate) return subTypeGate;

  const { error } = await ctx.admin.from("report_pack_subscriptions").insert({
    organization_id: ctx.orgId,
    report_pack_id: packId,
    audience_label: audience,
    schedule_cron: cron,
    recipient_emails: emails,
    active: true,
  });
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/reports");
  return { success: true as const };
}

export async function updateRenewalCheckpointWorkspaceFormAction(formData: FormData): Promise<void> {
  const r = await updateRenewalCheckpointWorkspaceAction(formData);
  if (r && "error" in r && r.error) {
    console.error("[v4] updateRenewalCheckpointWorkspaceAction", r.error);
  }
}

export async function updateRenewalCheckpointWorkspaceAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const checkpointId = String(formData.get("checkpointId") ?? "").trim();
  const raw = String(formData.get("workspaceJson") ?? "").trim();
  if (!checkpointId) return { error: "checkpointId is required" as const };
  let workspaceJson: Record<string, unknown>;
  try {
    workspaceJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: "workspaceJson must be valid JSON" as const };
  }
  const { error } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .update({ workspace_json: workspaceJson })
    .eq("id", checkpointId)
    .eq("organization_id", ctx.orgId);
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/renewals");
  revalidatePath("/contracts");
  return { success: true as const };
}

const RENEWAL_STATES_V4 = [
  "not_started",
  "gathering_inputs",
  "under_review",
  "decision_pending",
  "approved_to_renew",
  "approved_to_amend",
  "approved_to_terminate",
  "completed",
  "slipped",
] as const;

export async function updateRenewalCheckpointRenewalStateFormAction(formData: FormData): Promise<void> {
  const r = await updateRenewalCheckpointRenewalStateAction(formData);
  if (r && "error" in r && r.error) {
    console.error("[v4] updateRenewalCheckpointRenewalStateAction", r.error);
  }
}

export async function updateRenewalCheckpointRenewalStateAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const checkpointId = String(formData.get("checkpointId") ?? "").trim();
  const renewalState = String(formData.get("renewalState") ?? "").trim();
  if (!checkpointId) return { error: "checkpointId is required" as const };
  if (!RENEWAL_STATES_V4.includes(renewalState as (typeof RENEWAL_STATES_V4)[number])) {
    return { error: "Invalid renewal state" as const };
  }
  const { error } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .update({ renewal_state: renewalState })
    .eq("id", checkpointId)
    .eq("organization_id", ctx.orgId);
  if (error) return { error: mapDataSourceError(error.message) };
  revalidatePath("/contracts/renewals");
  revalidatePath("/contracts");
  return { success: true as const };
}

export async function generateRenewalDecisionPacketFormAction(formData: FormData): Promise<void> {
  const r = await generateRenewalDecisionPacketAction(formData);
  if (r && "error" in r && r.error) {
    console.error("[v4] generateRenewalDecisionPacketAction", r.error);
  }
}

export async function generateRenewalDecisionPacketAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return { error: "Not authenticated" as const };
  if (
    !hasRoleCapability({
      role: ctx.role,
      capability: "contracts_edit",
      rolePolicyJson: ctx.rolePolicyJson,
    })
  ) {
    return deny();
  }
  const checkpointId = String(formData.get("checkpointId") ?? "").trim();
  if (!checkpointId) return { error: "checkpointId is required" as const };

  const { data: checkpoint } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .select(
      "id, contract_id, organization_id, label, due_date, status, workspace_json, renewal_state, scenario_id"
    )
    .eq("id", checkpointId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!checkpoint) return { error: "Checkpoint not found" as const };

  const scenarioId = checkpoint.scenario_id as string | null | undefined;
  let scenarioRow: {
    id: string;
    scenario: string | null;
    workspace_status: string | null;
    target_decision_date: string | null;
    decision_date: string | null;
  } | null = null;
  if (scenarioId) {
    const { data: s } = await ctx.admin
      .from("contract_renewal_scenarios")
      .select("id, scenario, workspace_status, target_decision_date, decision_date")
      .eq("id", scenarioId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (s) scenarioRow = s;
  }

  const { packet_json, assumptions_json } = buildRenewalDecisionPacketPayload({
    checkpoint: {
      label: checkpoint.label as string | null,
      due_date: checkpoint.due_date as string | null,
      status: checkpoint.status as string | null,
      renewal_state: checkpoint.renewal_state as string | null,
      workspace_json: checkpoint.workspace_json,
    },
    scenarioRow,
    assumptionsFromRequest: null,
  });

  const summary = String(formData.get("packetSummary") ?? "").trim() || null;
  const { data: packet, error } = await ctx.admin
    .from("renewal_decision_packets")
    .insert({
      organization_id: ctx.orgId,
      contract_id: checkpoint.contract_id,
      checkpoint_id: checkpoint.id,
      status: "draft",
      summary,
      assumptions_json,
      packet_json,
      generated_by: ctx.userId,
      generated_at: new Date().toISOString(),
    })
    .select("id, status, summary, created_at")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };

  const { error: cpError } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .update({ decision_packet_id: packet.id, renewal_state: "under_review" })
    .eq("id", checkpoint.id)
    .eq("organization_id", ctx.orgId);
  if (cpError) return { error: mapDataSourceError(cpError.message) };

  await appendCasefileEvent({
    admin: ctx.admin,
    organizationId: ctx.orgId,
    contractId: checkpoint.contract_id as string,
    eventType: "renewal.decision_packet_generated",
    entityType: "renewal_decision_packet",
    entityId: packet.id,
    actorUserId: ctx.userId,
  });

  revalidatePath("/contracts/renewals");
  revalidatePath(`/contracts/${checkpoint.contract_id}`);
  return { success: true as const, packetId: packet.id as string };
}
