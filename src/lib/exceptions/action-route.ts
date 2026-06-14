import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import type { V10ExceptionResolutionAction } from "@/lib/approval-exception";
import {
  getV10ExceptionResolutionActionFeature,
  getV10ExceptionResolutionActionLabel,
  validateV10ExceptionResolution,
} from "@/lib/approval-exception";
import { appendCasefileEvent } from "@/lib/contract-operations/casefile";
import type { AuthContext } from "@/lib/contract-operations/api-auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import {
  buildV10MutationResponse,
  type V10MutationResponse,
} from "@/lib/mutation-envelope";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";

type RecordAuditEvent =
  typeof import("@/lib/server-contracts").recordV10AuditEvent;
type RefreshReadModelsForOrganization =
  typeof import("@/lib/read-model-refresh").refreshV10ReadModelsForOrganization;

export type ExceptionActionBody = {
  ownerId?: string;
  resolutionAction?: string;
  resolutionNote?: string;
  rootCause?: string;
  dueDate?: string;
};

export type ExceptionActionRow = {
  id: string;
  contract_id: string | null;
  status: string | null;
  severity: string | null;
  reopen_count: number | null;
  updated_at?: string | null;
};

export type ExceptionActionDependencies = {
  recordAuditEvent: RecordAuditEvent;
  refreshReadModelsForOrganization: RefreshReadModelsForOrganization;
};

type ExceptionActionInput = {
  ctx: AuthContext;
  id: string;
  row: ExceptionActionRow;
  body: ExceptionActionBody;
  now: string;
  dependencies: ExceptionActionDependencies;
};

const EXCEPTION_READ_MODEL_KEYS = [
  "work_items",
  "contract_health_snapshots",
  "contract_activity_events",
  "exception_records",
  "audit_events",
  "command_search_index",
] as const;

async function refreshExceptionReadModels(input: {
  ctx: AuthContext;
  row: ExceptionActionRow;
  dependencies: ExceptionActionDependencies;
}) {
  await input.dependencies.refreshReadModelsForOrganization(
    input.ctx.admin,
    input.ctx.orgId,
    {
      refreshScope: input.row.contract_id ? "one_contract" : "one_model",
      contractId: input.row.contract_id ?? undefined,
      reason: "exception_mutation",
      modelKeys: EXCEPTION_READ_MODEL_KEYS,
    },
  );
}

async function resolutionActionAllowed(input: {
  admin: Parameters<typeof loadProductSurfaceContext>[0];
  orgId: string;
  role: string;
  resolutionAction: V10ExceptionResolutionAction;
}) {
  const feature = getV10ExceptionResolutionActionFeature(
    input.resolutionAction,
  );
  if (!feature) return true;
  const productSurface = await loadProductSurfaceContext(
    input.admin as never,
    input.orgId,
    input.role as never,
  );
  return evaluateFeatureEligibility(productSurface, feature, {
    surfaceType: "api",
    surfaceIdentifier: "/api/exceptions/[id]/[action]",
  }).allowed;
}

export async function buildAssignExceptionMutationResponse(
  input: ExceptionActionInput & { ownerId: string; dueDate: string | null },
): Promise<V10MutationResponse> {
  const { ctx, id, row, ownerId, dueDate, dependencies } = input;
  if (!["open", "in_progress"].includes(String(row.status ?? "open"))) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message: "Only active exceptions can be reassigned.",
      diagnosticId: "v10_exception_assign_not_active",
    });
  }
  if (!ownerId) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message: "ownerId is required.",
      diagnosticId: "v10_exception_owner_required",
      validationFailures: [
        {
          field: "ownerId",
          code: "required",
          user_visible_message: "Select an owner.",
          self_fixable: true,
        },
      ],
    });
  }
  const { data: ownerMember, error: ownerMemberError } = await ctx.admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (ownerMemberError || !ownerMember) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message: ownerMemberError
        ? "Failed to validate owner."
        : "ownerId must belong to your organization.",
      diagnosticId: ownerMemberError
        ? "v10_exception_owner_lookup_failed"
        : "v10_exception_owner_wrong_org",
      validationFailures: [
        {
          field: "ownerId",
          code: ownerMemberError ? "lookup_failed" : "not_org_member",
          user_visible_message: ownerMemberError
            ? "Failed to validate owner."
            : "Owner must belong to your organization.",
          self_fixable: !ownerMemberError,
        },
      ],
    });
  }
  const { error } = await ctx.admin
    .from("exceptions")
    .update({ owner_id: ownerId, due_date: dueDate, status: "in_progress" })
    .eq("id", id)
    .eq("organization_id", ctx.orgId);
  if (error) {
    return buildV10MutationResponse({
      outcome: "server_error",
      message: "Failed to assign exception.",
      diagnosticId: "v10_exception_assign_failed",
    });
  }
  await ctx.admin.from("exception_events").insert({
    organization_id: ctx.orgId,
    exception_id: id,
    event_type: "assigned",
    actor_user_id: ctx.userId,
    details: { owner_id: ownerId, due_date: dueDate },
  });
  if (row.contract_id) {
    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: row.contract_id,
      eventType: "exception.assigned",
      entityType: "exception",
      entityId: id,
      actorUserId: ctx.userId,
      details: { owner_id: ownerId, due_date: dueDate },
    });
  }
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(
      () => undefined,
    );
  }
  const auditEventId = await dependencies.recordAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "exception.owner_changed",
    targetType: "exception",
    targetId: id,
    contractId: row.contract_id,
    outcome: "success",
    beforeStateHash: String(row.status ?? "open"),
    afterStateHash: "in_progress",
    safeMetadata: {
      owner_assigned: true,
      due_date_state: dueDate ? "provided" : "not_provided",
    },
  });
  await refreshExceptionReadModels({ ctx, row, dependencies });
  return buildV10MutationResponse({
    outcome: auditEventId ? "success" : "audit_write_failed",
    message: auditEventId
      ? "Exception assigned."
      : "Exception was not assigned because audit confirmation failed.",
    changedObjectType: "exception",
    changedObjectId: id,
    nextDestinationHref: row.contract_id
      ? `/contracts/${row.contract_id}?tab=overview#contract-exceptions`
      : "/contracts/exceptions",
    auditEventId,
    diagnosticId: auditEventId ? null : "v10_exception_assign_audit_missing",
  });
}

export async function buildResolveExceptionMutationResponse(
  input: ExceptionActionInput & { resolutionAction: string },
): Promise<V10MutationResponse> {
  const { ctx, id, row, body, now, resolutionAction, dependencies } = input;
  if (!["open", "in_progress"].includes(String(row.status ?? "open"))) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message: "Only active exceptions can be resolved.",
      diagnosticId: "v10_exception_resolve_not_active",
    });
  }
  const resolutionFailures = validateV10ExceptionResolution({
    resolutionAction,
    severity: row.severity as never,
    note: body.resolutionNote?.trim() || null,
  });
  if (resolutionFailures.includes("resolution_action_invalid")) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message: "Select a valid exception resolution action.",
      diagnosticId: "v10_exception_resolution_action_invalid",
    });
  }
  if (resolutionFailures.includes("resolution_note_required_for_high_risk")) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message: "Add a resolution note before resolving a high-risk exception.",
      diagnosticId: "v10_exception_resolution_note_required",
      validationFailures: [
        {
          field: "resolutionNote",
          code: "required",
          user_visible_message:
            "Add a resolution note before resolving a high-risk exception.",
          self_fixable: true,
        },
      ],
    });
  }
  if (
    !(await resolutionActionAllowed({
      admin: ctx.admin,
      orgId: ctx.orgId,
      role: ctx.role,
      resolutionAction: resolutionAction as V10ExceptionResolutionAction,
    }))
  ) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message:
        "This resolution path is not available in the current workspace configuration.",
      diagnosticId: "v10_exception_resolution_action_unavailable",
    });
  }
  const { error } = await ctx.admin
    .from("exceptions")
    .update({
      status: "resolved",
      resolution_action: resolutionAction,
      root_cause: body.rootCause?.trim() || null,
      resolution_note: body.resolutionNote?.trim() || null,
      resolved_at: now,
      resolved_by: ctx.userId,
    })
    .eq("id", id)
    .eq("organization_id", ctx.orgId);
  if (error) {
    return buildV10MutationResponse({
      outcome: "server_error",
      message: "Failed to resolve exception.",
      diagnosticId: "v10_exception_resolve_failed",
    });
  }

  await ctx.admin.from("exception_events").insert({
    organization_id: ctx.orgId,
    exception_id: id,
    event_type: "resolved",
    actor_user_id: ctx.userId,
    details: {
      resolution_action: resolutionAction,
      root_cause: body.rootCause ?? null,
      resolution_note: body.resolutionNote ?? null,
    },
  });
  if (row.contract_id) {
    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: row.contract_id,
      eventType: "exception.resolved",
      entityType: "exception",
      entityId: id,
      actorUserId: ctx.userId,
    });
  }
  await enqueueOutboundEvent({
    organizationId: ctx.orgId,
    eventType: "exception.resolved",
    entityType: "exception",
    entityId: id,
    payload: {
      contract_id: row.contract_id,
      resolution_action: resolutionAction,
      resolution_note: body.resolutionNote ?? null,
    },
  });
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.userId,
    contractId: row.contract_id,
    action: "product.v10.exception_resolution_recorded",
    details: {
      exception_id: id,
      resolution_action: resolutionAction,
      root_cause_state: body.rootCause?.trim() ? "provided" : "not_provided",
      resolution_note_state: body.resolutionNote?.trim()
        ? "provided"
        : "not_provided",
    },
  });
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(
      () => undefined,
    );
  }
  const auditEventId = await dependencies.recordAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "exception.resolved",
    targetType: "exception",
    targetId: id,
    contractId: row.contract_id,
    outcome: "success",
    beforeStateHash: String(row.status ?? "open"),
    afterStateHash: "resolved",
    safeMetadata: {
      resolution_action: resolutionAction,
      resolution_note_state: body.resolutionNote?.trim()
        ? "provided"
        : "not_provided",
    },
  });
  await refreshExceptionReadModels({ ctx, row, dependencies });
  return buildV10MutationResponse({
    outcome: auditEventId ? "success" : "audit_write_failed",
    message: auditEventId
      ? `${getV10ExceptionResolutionActionLabel(resolutionAction as V10ExceptionResolutionAction)} saved.`
      : "Exception was not resolved because audit confirmation failed.",
    changedObjectType: "exception",
    changedObjectId: id,
    nextDestinationHref: row.contract_id
      ? `/contracts/${row.contract_id}?tab=audit`
      : "/contracts/exceptions?status=resolved",
    auditEventId,
    diagnosticId: auditEventId ? null : "v10_exception_resolve_audit_missing",
  });
}

export async function buildReopenExceptionMutationResponse(
  input: ExceptionActionInput,
): Promise<V10MutationResponse> {
  const { ctx, id, row, dependencies } = input;
  if (!["resolved", "closed"].includes(String(row.status ?? "resolved"))) {
    return buildV10MutationResponse({
      outcome: "validation_failed",
      message: "Only resolved exceptions can be reopened.",
      diagnosticId: "v10_exception_reopen_not_resolved",
    });
  }
  const reopenCount = (row.reopen_count ?? 0) + 1;
  const { error } = await ctx.admin
    .from("exceptions")
    .update({
      status: "open",
      resolution_action: null,
      resolved_at: null,
      resolved_by: null,
      reopen_count: reopenCount,
    })
    .eq("id", id)
    .eq("organization_id", ctx.orgId);
  if (error) {
    return buildV10MutationResponse({
      outcome: "server_error",
      message: "Failed to reopen exception.",
      diagnosticId: "v10_exception_reopen_failed",
    });
  }
  await ctx.admin.from("exception_events").insert({
    organization_id: ctx.orgId,
    exception_id: id,
    event_type: "reopened",
    actor_user_id: ctx.userId,
    details: {},
  });
  if (row.contract_id) {
    await appendCasefileEvent({
      admin: ctx.admin,
      organizationId: ctx.orgId,
      contractId: row.contract_id,
      eventType: "exception.reopened",
      entityType: "exception",
      entityId: id,
      actorUserId: ctx.userId,
    });
  }
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(
      () => undefined,
    );
  }
  const auditEventId = await dependencies.recordAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "exception.reopened",
    targetType: "exception",
    targetId: id,
    contractId: row.contract_id,
    outcome: "success",
    beforeStateHash: String(row.status ?? "resolved"),
    afterStateHash: "open",
    safeMetadata: { reopen_count: reopenCount },
  });
  await refreshExceptionReadModels({ ctx, row, dependencies });
  return buildV10MutationResponse({
    outcome: auditEventId ? "success" : "audit_write_failed",
    message: auditEventId
      ? "Exception reopened."
      : "Exception was not reopened because audit confirmation failed.",
    changedObjectType: "exception",
    changedObjectId: id,
    nextDestinationHref: row.contract_id
      ? `/contracts/${row.contract_id}?tab=overview#contract-exceptions`
      : "/contracts/exceptions?status=open",
    auditEventId,
    diagnosticId: auditEventId ? null : "v10_exception_reopen_audit_missing",
  });
}
