"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import type { WorkspaceRole } from "@/lib/navigation";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { emitVisibleMutationErrorTelemetry } from "@/lib/product-telemetry";
import { isIsoDateOnly, isUuid } from "@/lib/security/validation";
import type { OrgRole } from "@/lib/types";
import { recordV10AuditEvent } from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { buildV10MutationResponse } from "@/lib/mutation-envelope";
import {
  getV10ExceptionResolutionActionFeature,
  getV10ExceptionResolutionActionLabel,
  type V10ExceptionResolutionAction,
  validateV10ExceptionResolution,
} from "@/lib/approval-exception";

const MAX_RESOLUTION_NOTE_LEN = 4000;

async function appendExceptionEvent(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    exceptionId: string;
    actorId: string;
    eventType: "assigned" | "resolved" | "reopened";
    details?: Record<string, unknown>;
  }
) {
  await admin.from("exception_events").insert({
    organization_id: input.organizationId,
    exception_id: input.exceptionId,
    event_type: input.eventType,
    actor_user_id: input.actorId,
    details: input.details ?? {},
  });
}

async function ensureOwnerMember(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  orgId: string,
  ownerId: string
) {
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", ownerId)
    .maybeSingle();
  return Boolean(data);
}

async function getEditableExceptionContext(exceptionId: string) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" as const };
  if (!isUuid(exceptionId)) return { error: "Invalid exception" as const };

  const { data: exception } = await admin
    .from("exceptions")
    .select("id, contract_id, organization_id, status, owner_id, due_date, severity")
    .eq("id", exceptionId)
    .maybeSingle();
  if (!exception) return { error: "Exception not found" as const };

  const role = await getOrgMemberRole(admin, user.id, exception.organization_id);
  if (!canEditContracts(role as OrgRole)) {
    return { error: "Viewers cannot update exceptions." as const };
  }

  return { admin, userId: user.id, role, exception } as const;
}

function revalidateExceptionPaths(contractId: string | null) {
  revalidatePath("/work");
  revalidatePath("/contracts/exceptions");
  if (contractId) revalidatePath(`/contracts/${contractId}`);
}

async function exceptionResolutionActionAllowed(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  organizationId: string;
  role: OrgRole | null;
  resolutionAction: V10ExceptionResolutionAction;
  surfaceIdentifier: string;
}) {
  const requiredFeature = getV10ExceptionResolutionActionFeature(input.resolutionAction);
  if (!requiredFeature) return true;
  const productSurface = await loadProductSurfaceContext(
    input.admin as never,
    input.organizationId,
    (input.role ?? "viewer") as WorkspaceRole
  );
  return evaluateFeatureEligibility(productSurface, requiredFeature, {
    surfaceType: "page",
    surfaceIdentifier: input.surfaceIdentifier,
  }).allowed;
}

async function refreshV10ExceptionReadModels(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  organizationId: string;
  contractId: string | null;
  reason: string;
}) {
  await refreshV10ReadModelsForOrganization(input.admin, input.organizationId, {
    refreshScope: input.contractId ? "one_contract" : "one_model",
    contractId: input.contractId ?? undefined,
    reason: input.reason,
    modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "exception_records", "audit_events", "command_search_index"],
  });
}

async function emitExceptionMutationError(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    organizationId: string;
    contractId: string | null;
    userId: string;
    mutation: "assignException" | "resolveException" | "reopenException";
    code: string;
  }
) {
  await emitVisibleMutationErrorTelemetry(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    contractId: input.contractId,
    surface: "exceptions",
    mutation: input.mutation,
    code: input.code,
  });
}

function buildExceptionMutationEnvelope(input: {
  outcome: "success" | "audit_write_failed";
  message: string;
  exceptionId: string;
  contractId: string | null;
  auditEventId: string | null;
}) {
  return buildV10MutationResponse({
    outcome: input.outcome,
    message: input.message,
    changedObjectType: "exception",
    changedObjectId: input.exceptionId,
    nextDestinationHref: input.contractId ? `/contracts/${input.contractId}?tab=overview#contract-exceptions` : "/contracts/exceptions",
    auditEventId: input.auditEventId,
    diagnosticId: input.outcome === "audit_write_failed" ? "v10_exception_audit_missing" : null,
  });
}

export async function assignException(input: {
  exceptionId: string;
  ownerId: string;
  dueDate?: string | null;
}) {
  const ctx = await getEditableExceptionContext(input.exceptionId);
  if ("error" in ctx) return { error: ctx.error };

  const ownerId = input.ownerId.trim();
  const dueDate = input.dueDate?.trim() || null;
  if (!ownerId || !isUuid(ownerId)) return { error: "Select a valid owner." };
  if (dueDate && !isIsoDateOnly(dueDate)) {
    return { error: "Enter a valid due date." };
  }
  if (!(await ensureOwnerMember(ctx.admin, ctx.exception.organization_id, ownerId))) {
    return { error: "Owner must be a member of this organization." };
  }
  if (!["open", "in_progress"].includes(ctx.exception.status)) {
    return { error: "Only active exceptions can be reassigned." };
  }

  const { error } = await ctx.admin
    .from("exceptions")
    .update({ owner_id: ownerId, due_date: dueDate, status: "in_progress" })
    .eq("organization_id", ctx.exception.organization_id)
    .eq("id", ctx.exception.id);
  if (error) {
    const code = mapDataSourceError(error.message);
    await emitExceptionMutationError(ctx.admin, {
      organizationId: ctx.exception.organization_id,
      contractId: ctx.exception.contract_id,
      userId: ctx.userId,
      mutation: "assignException",
      code,
    });
    return { error: code };
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.exception.organization_id,
    contract_id: ctx.exception.contract_id,
    user_id: ctx.userId,
    action: "exception.assigned",
    details: { exception_id: ctx.exception.id, owner_id: ownerId, due_date: dueDate },
  });
  const v10AuditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    actorUserId: ctx.userId,
    action: "exception.owner_changed",
    targetType: "exception",
    targetId: ctx.exception.id,
    contractId: ctx.exception.contract_id,
    outcome: "success",
    beforeStateHash: ctx.exception.status,
    afterStateHash: "in_progress",
    safeMetadata: { due_date: dueDate, owner_assigned: true },
  });
  await appendExceptionEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    exceptionId: ctx.exception.id,
    actorId: ctx.userId,
    eventType: "assigned",
    details: { owner_id: ownerId, due_date: dueDate },
  });
  await refreshV10ExceptionReadModels({
    admin: ctx.admin,
    organizationId: ctx.exception.organization_id,
    contractId: ctx.exception.contract_id,
    reason: "exception_owner_mutation",
  });

  revalidatePath("/contracts/exceptions");
  if (ctx.exception.contract_id) revalidatePath(`/contracts/${ctx.exception.contract_id}`);
  return {
    success: true as const,
    message: "Owner and due date saved. This exception is now in progress.",
    v10AuditEventId,
    v10: buildExceptionMutationEnvelope({
      outcome: v10AuditEventId ? "success" : "audit_write_failed",
      message: v10AuditEventId
        ? "Owner and due date saved. This exception is now in progress."
        : "Owner and due date saved, but audit confirmation is missing.",
      exceptionId: ctx.exception.id,
      contractId: ctx.exception.contract_id,
      auditEventId: v10AuditEventId,
    }),
  };
}

export async function resolveException(input: {
  exceptionId: string;
  resolutionAction?: V10ExceptionResolutionAction | null;
  resolutionNote?: string | null;
}) {
  const ctx = await getEditableExceptionContext(input.exceptionId);
  if ("error" in ctx) return { error: ctx.error };

  const resolutionAction = (input.resolutionAction?.trim() || "fixed") as V10ExceptionResolutionAction;
  const resolutionNote = input.resolutionNote?.trim() || null;
  if (resolutionNote && resolutionNote.length > MAX_RESOLUTION_NOTE_LEN) {
    return { error: "Resolution note is too long." };
  }
  if (!["open", "in_progress"].includes(ctx.exception.status)) {
    return { error: "Only active exceptions can be resolved." };
  }
  if (
    !(await exceptionResolutionActionAllowed({
      admin: ctx.admin,
      organizationId: ctx.exception.organization_id,
      role: ctx.role as OrgRole | null,
      resolutionAction,
      surfaceIdentifier: "/contracts/exceptions",
    }))
  ) {
    return { error: "This resolution path is not available in the current workspace configuration." };
  }
  const v10ResolutionFailures = validateV10ExceptionResolution({
    resolutionAction,
    severity: ctx.exception.severity,
    note: resolutionNote,
  });
  if (v10ResolutionFailures.includes("resolution_note_required_for_high_risk")) {
    return { error: "Add a resolution note before resolving a high-risk exception." };
  }
  if (v10ResolutionFailures.length > 0) {
    return { error: "Select a valid exception resolution action." };
  }

  const { error } = await ctx.admin
    .from("exceptions")
    .update({
      status: "resolved",
      resolution_action: resolutionAction,
      resolution_note: resolutionNote,
      resolved_at: new Date().toISOString(),
    })
    .eq("organization_id", ctx.exception.organization_id)
    .eq("id", ctx.exception.id);
  if (error) {
    const code = mapDataSourceError(error.message);
    await emitExceptionMutationError(ctx.admin, {
      organizationId: ctx.exception.organization_id,
      contractId: ctx.exception.contract_id,
      userId: ctx.userId,
      mutation: "resolveException",
      code,
    });
    return { error: code };
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.exception.organization_id,
    contract_id: ctx.exception.contract_id,
    user_id: ctx.userId,
    action: "exception.resolved",
    details: {
      exception_id: ctx.exception.id,
      resolution_action: resolutionAction,
      resolution_note: resolutionNote,
    },
  });
  const v10AuditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    actorUserId: ctx.userId,
    action: "exception.resolved",
    targetType: "exception",
    targetId: ctx.exception.id,
    contractId: ctx.exception.contract_id,
    outcome: "success",
    beforeStateHash: ctx.exception.status,
    afterStateHash: "resolved",
    safeMetadata: {
      resolution_action: resolutionAction,
      resolution_note_state: resolutionNote ? "provided" : "not_provided",
    },
  });
  await appendExceptionEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    exceptionId: ctx.exception.id,
    actorId: ctx.userId,
    eventType: "resolved",
    details: { resolution_action: resolutionAction, resolution_note: resolutionNote },
  });
  await refreshV10ExceptionReadModels({
    admin: ctx.admin,
    organizationId: ctx.exception.organization_id,
    contractId: ctx.exception.contract_id,
    reason: "exception_resolution_mutation",
  });

  revalidateExceptionPaths(ctx.exception.contract_id);
  return {
    success: true as const,
    message: `${getV10ExceptionResolutionActionLabel(resolutionAction)} saved. The resolution stays visible in history.`,
    v10AuditEventId,
    v10: buildExceptionMutationEnvelope({
      outcome: v10AuditEventId ? "success" : "audit_write_failed",
      message: v10AuditEventId
        ? `${getV10ExceptionResolutionActionLabel(resolutionAction)} saved. The resolution stays visible in history.`
        : `${getV10ExceptionResolutionActionLabel(resolutionAction)} saved, but audit confirmation is missing.`,
      exceptionId: ctx.exception.id,
      contractId: ctx.exception.contract_id,
      auditEventId: v10AuditEventId,
    }),
  };
}

export async function reopenException(input: { exceptionId: string }) {
  const ctx = await getEditableExceptionContext(input.exceptionId);
  if ("error" in ctx) return { error: ctx.error };

  if (!["resolved", "closed"].includes(ctx.exception.status)) {
    return { error: "Only resolved exceptions can be reopened." };
  }

  const { error } = await ctx.admin
    .from("exceptions")
    .update({ status: "open", resolution_action: null, resolved_at: null, resolved_by: null })
    .eq("organization_id", ctx.exception.organization_id)
    .eq("id", ctx.exception.id);
  if (error) {
    const code = mapDataSourceError(error.message);
    await emitExceptionMutationError(ctx.admin, {
      organizationId: ctx.exception.organization_id,
      contractId: ctx.exception.contract_id,
      userId: ctx.userId,
      mutation: "reopenException",
      code,
    });
    return { error: code };
  }

  await ctx.admin.from("audit_events").insert({
    organization_id: ctx.exception.organization_id,
    contract_id: ctx.exception.contract_id,
    user_id: ctx.userId,
    action: "exception.reopened",
    details: { exception_id: ctx.exception.id },
  });
  const v10AuditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    actorUserId: ctx.userId,
    action: "exception.reopened",
    targetType: "exception",
    targetId: ctx.exception.id,
    contractId: ctx.exception.contract_id,
    outcome: "success",
    beforeStateHash: ctx.exception.status,
    afterStateHash: "open",
    safeMetadata: {},
  });
  await appendExceptionEvent(ctx.admin, {
    organizationId: ctx.exception.organization_id,
    exceptionId: ctx.exception.id,
    actorId: ctx.userId,
    eventType: "reopened",
    details: {},
  });
  await refreshV10ExceptionReadModels({
    admin: ctx.admin,
    organizationId: ctx.exception.organization_id,
    contractId: ctx.exception.contract_id,
    reason: "exception_reopen_mutation",
  });

  revalidateExceptionPaths(ctx.exception.contract_id);
  return {
    success: true as const,
    message: "Exception reopened and returned to the active ledger.",
    v10AuditEventId,
    v10: buildExceptionMutationEnvelope({
      outcome: v10AuditEventId ? "success" : "audit_write_failed",
      message: v10AuditEventId
        ? "Exception reopened and returned to the active ledger."
        : "Exception reopened, but audit confirmation is missing.",
      exceptionId: ctx.exception.id,
      contractId: ctx.exception.contract_id,
      auditEventId: v10AuditEventId,
    }),
  };
}
