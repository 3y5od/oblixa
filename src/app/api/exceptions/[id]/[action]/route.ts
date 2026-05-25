import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/contract-operations/api-auth";
import { appendCasefileEvent } from "@/lib/contract-operations/casefile";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { runIncrementalAssuranceChecks } from "@/lib/assurance/assurance-checks";
import {
  getV10ExceptionResolutionActionFeature,
  getV10ExceptionResolutionActionLabel,
  type V10ExceptionResolutionAction,
  validateV10ExceptionResolution,
} from "@/lib/approval-exception";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
  type V10MutationResponse,
} from "@/lib/mutation-envelope";
import {
  executeV10IdempotentMutation,
  getV10ExpectedVersionFromRequest,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import { rejectInvalidRouteParamEnums, rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { isIsoDateOnly } from "@/lib/security/validation";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const EXCEPTION_ACTIONS = ["assign", "resolve", "reopen"] as const;

function jsonV10(response: V10MutationResponse, replayed = false) {
  return NextResponse.json(response, buildV10MutationResponseInit(response, { replayed, headers: PRIVATE_NO_STORE_HEADERS }));
}

async function resolutionActionAllowed(input: {
  admin: Parameters<typeof loadProductSurfaceContext>[0];
  orgId: string;
  role: string;
  resolutionAction: V10ExceptionResolutionAction;
}) {
  const feature = getV10ExceptionResolutionActionFeature(input.resolutionAction);
  if (!feature) return true;
  const productSurface = await loadProductSurfaceContext(input.admin as never, input.orgId, input.role as never);
  return evaluateFeatureEligibility(productSurface, feature, {
    surfaceType: "api",
    surfaceIdentifier: "/api/exceptions/[id]/[action]",
  }).allowed;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ id, action }, ["id", "action"], "/api/exceptions/[id]/[action]");
  if (routeParamRejection) return routeParamRejection;
  const routeActionRejection = rejectInvalidRouteParamEnums(
    { action },
    { action: EXCEPTION_ACTIONS },
    "/api/exceptions/[id]/[action]"
  );
  if (routeActionRejection) return routeActionRejection;
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_exception_action_unauthorized",
        nextDestinationHref: "/login",
      })
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/exceptions/[id]/[action]",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "maintenance_manage"))) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "forbidden",
        message: "Access denied.",
        diagnosticId: "v10_exception_action_forbidden",
      })
    );
  }

  const { data: row } = await ctx.admin
    .from("exceptions")
    .select("id, contract_id, status, severity, reopen_count, updated_at")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!row) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "not_found",
        message: "Exception not found.",
        diagnosticId: "v10_exception_action_not_found",
      })
    );
  }

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    ownerId?: string;
    resolutionAction?: string;
    resolutionNote?: string;
    rootCause?: string;
    dueDate?: string;
  };
  const dueDate = String(body.dueDate ?? "").trim() || null;
  if (dueDate && !isIsoDateOnly(dueDate)) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "validation_failed",
        message: "Invalid due date.",
        diagnosticId: "v10_exception_due_date_invalid",
        validationFailures: [
          {
            field: "dueDate",
            code: "invalid_date",
            user_visible_message: "Enter a valid due date.",
            self_fixable: true,
          },
        ],
      })
    );
  }
  const now = new Date().toISOString();

  if (action === "assign") {
    const ownerId = String(body.ownerId ?? "").trim();
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "exception.assign",
        targetType: "exception",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: row.updated_at ?? row.status,
        payload: { action, owner_id: ownerId, due_date: dueDate },
      },
      async () => {
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
            message: ownerMemberError ? "Failed to validate owner." : "ownerId must belong to your organization.",
            diagnosticId: ownerMemberError ? "v10_exception_owner_lookup_failed" : "v10_exception_owner_wrong_org",
            validationFailures: [
              {
                field: "ownerId",
                code: ownerMemberError ? "lookup_failed" : "not_org_member",
                user_visible_message: ownerMemberError ? "Failed to validate owner." : "Owner must belong to your organization.",
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
          await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
        }
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "exception.owner_changed",
          targetType: "exception",
          targetId: id,
          contractId: row.contract_id,
          outcome: "success",
          beforeStateHash: String(row.status ?? "open"),
          afterStateHash: "in_progress",
          safeMetadata: { owner_assigned: true, due_date_state: dueDate ? "provided" : "not_provided" },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: row.contract_id ? "one_contract" : "one_model",
          contractId: (row.contract_id as string | null) ?? undefined,
          reason: "exception_mutation",
          modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "exception_records", "audit_events", "command_search_index"],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Exception assigned." : "Exception was not assigned because audit confirmation failed.",
          changedObjectType: "exception",
          changedObjectId: id,
          nextDestinationHref: row.contract_id ? `/contracts/${row.contract_id}?tab=overview#contract-exceptions` : "/contracts/exceptions",
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_exception_assign_audit_missing",
        });
      }
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "resolve") {
    const resolutionAction = String(body.resolutionAction ?? "fixed").trim() || "fixed";
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "exception.resolve",
        targetType: "exception",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: row.updated_at ?? row.status,
        payload: {
          action,
          resolution_action: resolutionAction,
          root_cause_state: body.rootCause?.trim() ? "provided" : "not_provided",
          resolution_note_state: body.resolutionNote?.trim() ? "provided" : "not_provided",
        },
      },
      async () => {
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
                user_visible_message: "Add a resolution note before resolving a high-risk exception.",
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
            message: "This resolution path is not available in the current workspace configuration.",
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
            resolution_note_state: body.resolutionNote?.trim() ? "provided" : "not_provided",
          },
        });
        if (isFeatureEnabled("v6AssuranceCore")) {
          await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
        }
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
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
            resolution_note_state: body.resolutionNote?.trim() ? "provided" : "not_provided",
          },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: row.contract_id ? "one_contract" : "one_model",
          contractId: (row.contract_id as string | null) ?? undefined,
          reason: "exception_mutation",
          modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "exception_records", "audit_events", "command_search_index"],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId
            ? `${getV10ExceptionResolutionActionLabel(resolutionAction as V10ExceptionResolutionAction)} saved.`
            : "Exception was not resolved because audit confirmation failed.",
          changedObjectType: "exception",
          changedObjectId: id,
          nextDestinationHref: row.contract_id ? `/contracts/${row.contract_id}?tab=audit` : "/contracts/exceptions?status=resolved",
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_exception_resolve_audit_missing",
        });
      }
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "reopen") {
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "exception.reopen",
        targetType: "exception",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: row.updated_at ?? row.status,
        payload: { action, reopen_count: (row.reopen_count ?? 0) + 1 },
      },
      async () => {
        if (!["resolved", "closed"].includes(String(row.status ?? "resolved"))) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "Only resolved exceptions can be reopened.",
            diagnosticId: "v10_exception_reopen_not_resolved",
          });
        }
        const { error } = await ctx.admin
          .from("exceptions")
          .update({
            status: "open",
            resolution_action: null,
            resolved_at: null,
            resolved_by: null,
            reopen_count: (row.reopen_count ?? 0) + 1,
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
          await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
        }
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "exception.reopened",
          targetType: "exception",
          targetId: id,
          contractId: row.contract_id,
          outcome: "success",
          beforeStateHash: String(row.status ?? "resolved"),
          afterStateHash: "open",
          safeMetadata: { reopen_count: (row.reopen_count ?? 0) + 1 },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: row.contract_id ? "one_contract" : "one_model",
          contractId: (row.contract_id as string | null) ?? undefined,
          reason: "exception_mutation",
          modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "exception_records", "audit_events", "command_search_index"],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Exception reopened." : "Exception was not reopened because audit confirmation failed.",
          changedObjectType: "exception",
          changedObjectId: id,
          nextDestinationHref: row.contract_id ? `/contracts/${row.contract_id}?tab=overview#contract-exceptions` : "/contracts/exceptions?status=open",
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_exception_reopen_audit_missing",
        });
      }
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  return jsonV10(
    buildV10MutationResponse({
      outcome: "not_found",
      message: "Unsupported action.",
      diagnosticId: "v10_exception_action_unsupported",
    })
  );
}
