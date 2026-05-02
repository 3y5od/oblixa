import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
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
        diagnosticId: "v10_approval_action_unauthorized",
        nextDestinationHref: "/login",
      })
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/approvals/[id]/[action]",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "approvals_manage"))) {
    const response = buildV10MutationResponse({
      outcome: "forbidden",
      message: "Access denied.",
      diagnosticId: "v10_approval_action_forbidden",
    });
    return jsonV10(response);
  }

  const { data: approval } = await ctx.admin
    .from("contract_approvals")
    .select("id, organization_id, status, contract_id, updated_at")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!approval) {
    const response = buildV10MutationResponse({
      outcome: "not_found",
      message: "Approval not found.",
      diagnosticId: "v10_approval_action_not_found",
    });
    return jsonV10(response);
  }

  if (action === "approve" || action === "reject" || action === "request-changes") {
    const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as { note?: string };
    const nextStatus =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested";
    const eventType =
      action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested";
    const auditAction =
      action === "approve"
        ? "approval.approved"
        : action === "reject"
          ? "approval.rejected"
          : "approval.changes_requested";
    const message =
      action === "approve"
        ? "Approval approved."
        : action === "reject"
          ? "Approval rejected."
          : "Changes requested.";
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: `approval.${action}`,
        targetType: "approval",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: approval.updated_at ?? approval.status,
        payload: { action, note_state: body.note?.trim() ? "provided" : "not_provided" },
      },
      async () => {
        const { error } = await ctx.admin
          .from("contract_approvals")
          .update({
            status: nextStatus,
            notes: body.note?.trim() || null,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("organization_id", ctx.orgId);
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Approval could not be updated.",
            diagnosticId: "v10_approval_decision_update_failed",
          });
        }

        await ctx.admin.from("contract_approval_events").insert({
          organization_id: ctx.orgId,
          contract_id: approval.contract_id,
          approval_id: id,
          actor_id: ctx.userId,
          event_type: eventType,
          details: { note_state: body.note?.trim() ? "provided" : "not_provided" },
        });
        await appendCasefileEvent({
          admin: ctx.admin,
          organizationId: ctx.orgId,
          contractId: approval.contract_id,
          eventType: auditAction,
          entityType: "approval",
          entityId: id,
          actorUserId: ctx.userId,
          details: { note_state: body.note?.trim() ? "provided" : "not_provided" },
        });
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: auditAction,
          targetType: "approval",
          targetId: id,
          contractId: approval.contract_id,
          outcome: "success",
          beforeStateHash: String(approval.status ?? "pending"),
          afterStateHash: nextStatus,
          safeMetadata: { note_state: body.note?.trim() ? "provided" : "not_provided" },
        });
        await emitProductTelemetryEvent(ctx.admin, {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          contractId: approval.contract_id,
          action: "product.v10.approval_decision_recorded",
          details: {
            action,
            outcome: nextStatus,
            note_state: body.note?.trim() ? "provided" : "not_provided",
          },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: approval.contract_id ? "one_contract" : "one_model",
          contractId: (approval.contract_id as string | null) ?? undefined,
          reason: "approval_mutation",
          modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "approval_records", "audit_events", "command_search_index"],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? message : "Approval decision was not saved because audit confirmation failed.",
          changedObjectType: "approval",
          changedObjectId: id,
          nextDestinationHref: `/contracts/${approval.contract_id}?tab=overview#renewal-approvals`,
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_approval_decision_audit_missing",
        });
      }
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "delegate") {
    const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as { delegateUserId?: string };
    const delegateUserId = String(body.delegateUserId ?? "").trim();
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "approval.delegate",
        targetType: "approval",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: approval.updated_at ?? approval.status,
        payload: { action, delegate_user_id: delegateUserId },
      },
      async () => {
        if (!delegateUserId || !/^[0-9a-f]{8}-/i.test(delegateUserId)) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "Invalid delegate user.",
            diagnosticId: "v10_approval_delegate_user_invalid",
            validationFailures: [
              {
                field: "delegateUserId",
                code: "invalid_uuid",
                user_visible_message: "Select a valid delegate user.",
                self_fixable: true,
              },
            ],
          });
        }
        const { data: delegateMember, error: delegateMemberError } = await ctx.admin
          .from("organization_members")
          .select("id")
          .eq("organization_id", ctx.orgId)
          .eq("user_id", delegateUserId)
          .maybeSingle();
        if (delegateMemberError) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "Delegate could not be validated.",
            diagnosticId: "v10_approval_delegate_member_lookup_failed",
            validationFailures: [
              {
                field: "delegateUserId",
                code: "lookup_failed",
                user_visible_message: "Delegate could not be validated.",
                self_fixable: false,
              },
            ],
          });
        }
        if (!delegateMember) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "delegateUserId must belong to your organization.",
            diagnosticId: "v10_approval_delegate_wrong_org",
            validationFailures: [
              {
                field: "delegateUserId",
                code: "not_org_member",
                user_visible_message: "Delegate must belong to your organization.",
                self_fixable: true,
              },
            ],
          });
        }
        const { error } = await ctx.admin
          .from("contract_approvals")
          .update({
            approver_id: delegateUserId,
            escalation_status: "none",
            escalation_at: null,
          })
          .eq("id", id)
          .eq("organization_id", ctx.orgId);
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Approval could not be delegated.",
            diagnosticId: "v10_approval_delegate_update_failed",
          });
        }

        await ctx.admin.from("contract_approval_events").insert({
          organization_id: ctx.orgId,
          contract_id: approval.contract_id,
          approval_id: id,
          actor_id: ctx.userId,
          event_type: "delegated",
          details: { delegate_user_id: delegateUserId },
        });
        await appendCasefileEvent({
          admin: ctx.admin,
          organizationId: ctx.orgId,
          contractId: approval.contract_id,
          eventType: "approval.delegated",
          entityType: "approval",
          entityId: id,
          actorUserId: ctx.userId,
          details: { delegate_user_id: delegateUserId },
        });
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "approval.delegated",
          targetType: "approval",
          targetId: id,
          contractId: approval.contract_id,
          outcome: "success",
          beforeStateHash: String(approval.status ?? "pending"),
          afterStateHash: "delegated",
          safeMetadata: { delegate_user_assigned: true },
        });
        await emitProductTelemetryEvent(ctx.admin, {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          contractId: approval.contract_id,
          action: "product.v10.approval_decision_recorded",
          details: { action: "delegate", outcome: "delegated" },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: approval.contract_id ? "one_contract" : "one_model",
          contractId: (approval.contract_id as string | null) ?? undefined,
          reason: "approval_mutation",
          modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "approval_records", "audit_events", "command_search_index"],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Approval delegated." : "Approval was not delegated because audit confirmation failed.",
          changedObjectType: "approval",
          changedObjectId: id,
          nextDestinationHref: `/contracts/${approval.contract_id}?tab=overview#renewal-approvals`,
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_approval_delegate_audit_missing",
        });
      }
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "escalate") {
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "approval.escalate",
        targetType: "approval",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion: approval.updated_at ?? approval.status,
        payload: { action },
      },
      async () => {
        const { error } = await ctx.admin
          .from("contract_approvals")
          .update({
            escalation_status: "escalated",
            escalated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("organization_id", ctx.orgId);
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Approval could not be escalated.",
            diagnosticId: "v10_approval_escalate_update_failed",
          });
        }

        await ctx.admin.from("contract_approval_events").insert({
          organization_id: ctx.orgId,
          contract_id: approval.contract_id,
          approval_id: id,
          actor_id: ctx.userId,
          event_type: "escalated",
          details: {},
        });
        await appendCasefileEvent({
          admin: ctx.admin,
          organizationId: ctx.orgId,
          contractId: approval.contract_id,
          eventType: "approval.escalated",
          entityType: "approval",
          entityId: id,
          actorUserId: ctx.userId,
          details: {},
        });
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "approval.escalated",
          targetType: "approval",
          targetId: id,
          contractId: approval.contract_id,
          outcome: "success",
          beforeStateHash: String(approval.status ?? "pending"),
          afterStateHash: "escalated",
          safeMetadata: {},
        });
        await emitProductTelemetryEvent(ctx.admin, {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          contractId: approval.contract_id,
          action: "product.v10.approval_decision_recorded",
          details: { action: "escalate", outcome: "escalated" },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: approval.contract_id ? "one_contract" : "one_model",
          contractId: (approval.contract_id as string | null) ?? undefined,
          reason: "approval_mutation",
          modelKeys: ["work_items", "contract_health_snapshots", "contract_activity_events", "approval_records", "audit_events", "command_search_index"],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Approval escalated." : "Approval was not escalated because audit confirmation failed.",
          changedObjectType: "approval",
          changedObjectId: id,
          nextDestinationHref: `/contracts/${approval.contract_id}?tab=overview#renewal-approvals`,
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_approval_escalate_audit_missing",
        });
      }
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  return jsonV10(
    buildV10MutationResponse({
      outcome: "not_found",
      message: "Unsupported action.",
      diagnosticId: "v10_approval_action_unsupported",
    })
  );
}
