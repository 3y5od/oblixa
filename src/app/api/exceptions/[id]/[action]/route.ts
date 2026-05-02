import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
  type V10MutationResponse,
} from "@/lib/v10-mutation-envelope";
import {
  executeV10IdempotentMutation,
  getV10ExpectedVersionFromRequest,
  getV10IdempotencyKeyFromRequest,
  recordV10AuditEvent,
} from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function jsonV10(response: V10MutationResponse, replayed = false) {
  return NextResponse.json(response, buildV10MutationResponseInit(response, { replayed, headers: PRIVATE_NO_STORE_HEADERS }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
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
    .select("id, contract_id, status, reopen_count, updated_at")
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
    resolutionNote?: string;
    rootCause?: string;
    dueDate?: string;
  };
  if (body.dueDate && isNaN(new Date(body.dueDate).getTime())) {
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
        payload: { action, owner_id: ownerId, due_date: body.dueDate ?? null },
      },
      async () => {
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
          .update({ owner_id: ownerId, due_date: body.dueDate || null, status: "in_progress" })
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
          details: { owner_id: ownerId, due_date: body.dueDate ?? null },
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
            details: { owner_id: ownerId, due_date: body.dueDate ?? null },
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
          safeMetadata: { owner_assigned: true, due_date_state: body.dueDate ? "provided" : "not_provided" },
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
        payload: { action, root_cause_state: body.rootCause?.trim() ? "provided" : "not_provided", resolution_note_state: body.resolutionNote?.trim() ? "provided" : "not_provided" },
      },
      async () => {
        const { error } = await ctx.admin
          .from("exceptions")
          .update({
            status: "resolved",
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
          details: { root_cause: body.rootCause ?? null, resolution_note: body.resolutionNote ?? null },
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
          safeMetadata: { resolution_note_state: body.resolutionNote?.trim() ? "provided" : "not_provided" },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: row.contract_id ? "one_contract" : "one_model",
          contractId: (row.contract_id as string | null) ?? undefined,
          reason: "exception_mutation",
          modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "exception_records", "audit_events", "command_search_index"],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Exception resolved." : "Exception was not resolved because audit confirmation failed.",
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
        const { error } = await ctx.admin
          .from("exceptions")
          .update({
            status: "open",
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
