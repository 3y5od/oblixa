import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import {
  getApiAuthContext,
  canManageCapability,
} from "@/lib/contract-operations/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import {
  approvalNoteState,
  buildApprovalActionSuccessResponse,
  buildApprovalDecisionConfig,
  trimApprovalNote,
  validateApprovalDelegateUser,
  type ApprovalActionBody,
  type ApprovalActionRow,
  type ApprovalDecisionAction,
} from "@/lib/approvals/action-route";
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
import { validateV10ApprovalDecision } from "@/lib/approval-exception";
import { refreshV10ReadModelsForOrganization } from "@/lib/read-model-refresh";
import {
  rejectInvalidRouteParamEnums,
  rejectUnsafeRouteParams,
} from "@/lib/security/route-params";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const APPROVAL_ACTIONS = [
  "approve",
  "reject",
  "request-changes",
  "delegate",
  "escalate",
] as const;

function jsonV10(response: V10MutationResponse, replayed = false) {
  return NextResponse.json(
    response,
    buildV10MutationResponseInit(response, {
      replayed,
      headers: PRIVATE_NO_STORE_HEADERS,
    }),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  const routeParamRejection = rejectUnsafeRouteParams(
    { id, action },
    ["id", "action"],
    "/api/approvals/[id]/[action]",
  );
  if (routeParamRejection) return routeParamRejection;
  const routeActionRejection = rejectInvalidRouteParamEnums(
    { action },
    { action: APPROVAL_ACTIONS },
    "/api/approvals/[id]/[action]",
  );
  if (routeActionRejection) return routeActionRejection;
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_approval_action_unauthorized",
        nextDestinationHref: "/login",
      }),
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
  const approvalRow = approval as ApprovalActionRow;
  const dependencies = {
    recordAuditEvent: recordV10AuditEvent,
    refreshReadModelsForOrganization: refreshV10ReadModelsForOrganization,
  };

  if (
    action === "approve" ||
    action === "reject" ||
    action === "request-changes"
  ) {
    const _lb_body = await readJsonBodyLimited(request);
    if (!_lb_body.ok) return _lb_body.response;
    const body = (_lb_body.body ?? {}) as ApprovalActionBody;
    const note = trimApprovalNote(body.note);
    const noteState = approvalNoteState(note);
    const decision = buildApprovalDecisionConfig(
      action as ApprovalDecisionAction,
    );
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
        currentVersion: approvalRow.updated_at ?? approvalRow.status,
        payload: { action, note_state: noteState },
      },
      async () => {
        if (approvalRow.status !== "pending") {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "Only pending approvals can be updated.",
            diagnosticId: "v10_approval_decision_not_pending",
          });
        }
        const validationFailures = validateV10ApprovalDecision({
          status: approvalRow.status,
          decision: decision.nextStatus,
          note,
        });
        if (validationFailures.includes("decision_note_required")) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message:
              "Add a decision note before rejecting this approval or requesting changes.",
            diagnosticId: "v10_approval_decision_note_required",
            validationFailures: [
              {
                field: "note",
                code: "required",
                user_visible_message:
                  "Add a decision note before rejecting this approval or requesting changes.",
                self_fixable: true,
              },
            ],
          });
        }
        const { data: updatedApproval, error } = await ctx.admin
          .from("contract_approvals")
          .update({
            status: decision.nextStatus,
            notes: note,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("organization_id", ctx.orgId)
          .eq("status", "pending")
          .select("id, status")
          .maybeSingle();
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Approval could not be updated.",
            diagnosticId: "v10_approval_decision_update_failed",
          });
        }
        if (!updatedApproval) {
          return buildV10MutationResponse({
            outcome: "conflict",
            message: "Approval status changed before this decision was saved.",
            diagnosticId: "v10_approval_decision_stale_status",
          });
        }

        return buildApprovalActionSuccessResponse({
          ctx,
          approval: approvalRow,
          id,
          dependencies,
          approvalEventType: decision.eventType,
          approvalEventDetails: { note_state: noteState },
          auditAction: decision.auditAction,
          auditAfterStateHash: decision.nextStatus,
          auditSafeMetadata: { note_state: noteState },
          telemetryDetails: {
            action,
            outcome: decision.nextStatus,
            note_state: noteState,
          },
          message: decision.message,
          auditMissingMessage:
            "Approval decision was not saved because audit confirmation failed.",
          auditMissingDiagnosticId: "v10_approval_decision_audit_missing",
        });
      },
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "delegate") {
    const _lb_body = await readJsonBodyLimited(request);
    if (!_lb_body.ok) return _lb_body.response;
    const body = (_lb_body.body ?? {}) as ApprovalActionBody;
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
        currentVersion: approvalRow.updated_at ?? approvalRow.status,
        payload: { action, delegate_user_id: delegateUserId },
      },
      async () => {
        if (approvalRow.status !== "pending") {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "Only pending approvals can be delegated.",
            diagnosticId: "v10_approval_delegate_not_pending",
          });
        }
        const delegateValidation = await validateApprovalDelegateUser(
          ctx,
          delegateUserId,
        );
        if (delegateValidation) return delegateValidation;
        const { data: updatedApproval, error } = await ctx.admin
          .from("contract_approvals")
          .update({
            approver_id: delegateUserId,
            escalation_status: "none",
            escalation_at: null,
          })
          .eq("id", id)
          .eq("organization_id", ctx.orgId)
          .eq("status", "pending")
          .select("id, status")
          .maybeSingle();
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Approval could not be delegated.",
            diagnosticId: "v10_approval_delegate_update_failed",
          });
        }
        if (!updatedApproval) {
          return buildV10MutationResponse({
            outcome: "conflict",
            message: "Approval status changed before delegation was saved.",
            diagnosticId: "v10_approval_delegate_stale_status",
          });
        }

        return buildApprovalActionSuccessResponse({
          ctx,
          approval: approvalRow,
          id,
          dependencies,
          approvalEventType: "delegated",
          approvalEventDetails: { delegate_user_id: delegateUserId },
          auditAction: "approval.delegated",
          auditAfterStateHash: "delegated",
          auditSafeMetadata: { delegate_user_assigned: true },
          telemetryDetails: { action: "delegate", outcome: "delegated" },
          message: "Approval delegated.",
          auditMissingMessage:
            "Approval was not delegated because audit confirmation failed.",
          auditMissingDiagnosticId: "v10_approval_delegate_audit_missing",
        });
      },
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
        currentVersion: approvalRow.updated_at ?? approvalRow.status,
        payload: { action },
      },
      async () => {
        if (approvalRow.status !== "pending") {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "Only pending approvals can be escalated.",
            diagnosticId: "v10_approval_escalate_not_pending",
          });
        }
        const { data: updatedApproval, error } = await ctx.admin
          .from("contract_approvals")
          .update({
            escalation_status: "escalated",
            escalated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("organization_id", ctx.orgId)
          .eq("status", "pending")
          .select("id, status")
          .maybeSingle();
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Approval could not be escalated.",
            diagnosticId: "v10_approval_escalate_update_failed",
          });
        }
        if (!updatedApproval) {
          return buildV10MutationResponse({
            outcome: "conflict",
            message: "Approval status changed before escalation was saved.",
            diagnosticId: "v10_approval_escalate_stale_status",
          });
        }

        return buildApprovalActionSuccessResponse({
          ctx,
          approval: approvalRow,
          id,
          dependencies,
          approvalEventType: "escalated",
          approvalEventDetails: {},
          auditAction: "approval.escalated",
          auditAfterStateHash: "escalated",
          auditSafeMetadata: {},
          telemetryDetails: { action: "escalate", outcome: "escalated" },
          message: "Approval escalated.",
          auditMissingMessage:
            "Approval was not escalated because audit confirmation failed.",
          auditMissingDiagnosticId: "v10_approval_escalate_audit_missing",
        });
      },
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  return jsonV10(
    buildV10MutationResponse({
      outcome: "not_found",
      message: "Unsupported action.",
      diagnosticId: "v10_approval_action_unsupported",
    }),
  );
}
