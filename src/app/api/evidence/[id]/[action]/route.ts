import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { revalidatePath } from "next/cache";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { enqueueOutboundEvent } from "@/lib/integrations/events";
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
import { rejectInvalidRouteParamEnums, rejectUnsafeRouteParams } from "@/lib/security/route-params";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const EVIDENCE_ACTIONS = ["approve", "reject"] as const;

function jsonV10(response: V10MutationResponse, replayed = false) {
  return NextResponse.json(response, buildV10MutationResponseInit(response, { replayed, headers: PRIVATE_NO_STORE_HEADERS }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ id, action }, ["id", "action"], "/api/evidence/[id]/[action]");
  if (routeParamRejection) return routeParamRejection;
  const routeActionRejection = rejectInvalidRouteParamEnums(
    { action },
    { action: EVIDENCE_ACTIONS },
    "/api/evidence/[id]/[action]"
  );
  if (routeActionRejection) return routeActionRejection;
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_evidence_action_unauthorized",
      })
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/evidence/[id]/[action]",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "approvals_manage"))) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "forbidden",
        message: "Access denied.",
        diagnosticId: "v10_evidence_action_forbidden",
      })
    );
  }

  const { data: submission } = await ctx.admin
    .from("evidence_submissions")
    .select("id, requirement_id, status, updated_at")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!submission) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "not_found",
        message: "Submission not found.",
        diagnosticId: "v10_evidence_submission_not_found",
      })
    );
  }

  const { data: requirementRow } = await ctx.admin
    .from("evidence_requirements")
    .select("contract_id, title")
    .eq("id", submission.requirement_id as string)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();

  let rejectBody: { reason?: string } = {};
  if (action === "reject") {
    const rr = await readJsonBodyLimited(request);
    if (!rr.ok) return rr.response;
    rejectBody = (rr.body && typeof rr.body === "object" && !Array.isArray(rr.body) ? rr.body : {}) as {
      reason?: string;
    };
  }
  if (rejectBody.reason && rejectBody.reason.length > 4000) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "validation_failed",
        message: "Reason is too long.",
        diagnosticId: "v10_evidence_reject_reason_too_long",
        validationFailures: [
          {
            field: "reason",
            code: "too_long",
            user_visible_message: "Use a shorter rejection reason.",
            self_fixable: true,
          },
        ],
      })
    );
  }
  if (action !== "approve" && action !== "reject") {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "not_found",
        message: "Unsupported action.",
        diagnosticId: "v10_evidence_action_unsupported",
      })
    );
  }
  if (submission.status !== "submitted") {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "conflict",
        message: "Only submitted evidence can be reviewed.",
        diagnosticId: "v10_evidence_review_not_submitted",
      })
    );
  }

  const mutation = await executeV10IdempotentMutation(
    ctx.admin,
    {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      mutationName: `evidence.${action}`,
      targetType: "evidence_request",
      targetId: String(submission.requirement_id),
      idempotencyKey: getV10IdempotencyKeyFromRequest(request),
      expectedVersion: getV10ExpectedVersionFromRequest(request),
      currentVersion: submission.updated_at ?? submission.status,
      payload: { id, action, reason_state: rejectBody.reason?.trim() ? "provided" : "not_provided" },
    },
    async () => {
      if (action === "approve") {
    const { data: updatedSubmission, error } = await ctx.admin
      .from("evidence_submissions")
      .update({ status: "approved", reviewer_id: ctx.userId, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .eq("status", "submitted")
      .select("id, status")
      .maybeSingle();
    if (error) {
      return buildV10MutationResponse({
        outcome: "server_error",
        message: "Failed to update submission.",
        diagnosticId: "v10_evidence_approve_submission_failed",
      });
    }
    if (!updatedSubmission) {
      return buildV10MutationResponse({
        outcome: "conflict",
        message: "Evidence status changed before approval was saved.",
        diagnosticId: "v10_evidence_approve_stale_status",
      });
    }
    const { error: reqError } = await ctx.admin
      .from("evidence_requirements")
      .update({ status: "approved" })
      .eq("id", submission.requirement_id)
      .eq("organization_id", ctx.orgId);
    if (reqError) {
      return buildV10MutationResponse({
        outcome: "server_error",
        message: "Failed to update requirement.",
        diagnosticId: "v10_evidence_approve_requirement_failed",
      });
    }
    const cid = requirementRow?.contract_id as string | null;
    if (cid) {
      await appendCasefileEvent({
        admin: ctx.admin,
        organizationId: ctx.orgId,
        contractId: cid,
        eventType: "evidence.approved",
        entityType: "evidence_submission",
        entityId: id,
        actorUserId: ctx.userId,
        details: { requirement_id: submission.requirement_id },
      });
    }
    await enqueueOutboundEvent({
      organizationId: ctx.orgId,
      eventType: "evidence.submission_approved",
      entityType: "evidence_submission",
      entityId: id,
      payload: {
        contract_id: cid,
        requirement_id: submission.requirement_id,
        title: requirementRow?.title,
      },
    });
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v9.evidence_review_decision_recorded",
      details: { decision: "approve", requirementId: String(submission.requirement_id) },
    });
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v10.evidence_review_decision_recorded",
      details: { decision: "approve", requirement_id: String(submission.requirement_id) },
    });
    const auditEventId = await recordV10AuditEvent(ctx.admin, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "evidence_request.accepted",
      targetType: "evidence_request",
      targetId: String(submission.requirement_id),
      contractId: cid,
      outcome: "success",
      beforeStateHash: "submitted",
      afterStateHash: "approved",
      safeMetadata: { submission_id: id },
    });
    await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
      refreshScope: cid ? "one_contract" : "one_model",
      contractId: cid ?? undefined,
      reason: "evidence_review_mutation",
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
    revalidatePath("/contracts/evidence-studio");
    if (cid) revalidatePath(`/contracts/${cid}`);
        return {
          ...buildV10MutationResponse({
            outcome: auditEventId ? "success" : "audit_write_failed",
            message: auditEventId ? "Evidence approved." : "Evidence was not approved because audit confirmation failed.",
            changedObjectType: "evidence_request",
            changedObjectId: String(submission.requirement_id),
            nextDestinationHref: cid ? `/contracts/${cid}` : "/contracts/evidence-studio",
            auditEventId,
            diagnosticId: auditEventId ? null : "v10_evidence_approve_audit_missing",
          }),
          ok: true,
        };
      }

      if (action === "reject") {
    const { data: updatedSubmission, error } = await ctx.admin
      .from("evidence_submissions")
      .update({
        status: "rejected",
        reviewer_id: ctx.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectBody.reason?.trim() || "Rejected by reviewer",
      })
      .eq("id", id)
      .eq("organization_id", ctx.orgId)
      .eq("status", "submitted")
      .select("id, status")
      .maybeSingle();
    if (error) {
      return buildV10MutationResponse({
        outcome: "server_error",
        message: "Failed to update submission.",
        diagnosticId: "v10_evidence_reject_submission_failed",
      });
    }
    if (!updatedSubmission) {
      return buildV10MutationResponse({
        outcome: "conflict",
        message: "Evidence status changed before rejection was saved.",
        diagnosticId: "v10_evidence_reject_stale_status",
      });
    }
    const { error: reqError } = await ctx.admin
      .from("evidence_requirements")
      .update({ status: "rejected" })
      .eq("id", submission.requirement_id)
      .eq("organization_id", ctx.orgId);
    if (reqError) {
      return buildV10MutationResponse({
        outcome: "server_error",
        message: "Failed to update requirement.",
        diagnosticId: "v10_evidence_reject_requirement_failed",
      });
    }
    const cid = requirementRow?.contract_id as string | null;
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v9.evidence_review_decision_recorded",
      details: { decision: "reject", requirementId: String(submission.requirement_id) },
    });
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v10.evidence_review_decision_recorded",
      details: { decision: "reject", requirement_id: String(submission.requirement_id) },
    });
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: cid,
      action: "product.v9.evidence_rejected",
      details: { requirementId: String(submission.requirement_id) },
    });
    const auditEventId = await recordV10AuditEvent(ctx.admin, {
      organizationId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "evidence_request.rejected",
      targetType: "evidence_request",
      targetId: String(submission.requirement_id),
      contractId: cid,
      outcome: "success",
      beforeStateHash: "submitted",
      afterStateHash: "rejected",
      safeMetadata: { submission_id: id, reason_state: rejectBody.reason?.trim() ? "provided" : "defaulted" },
    });
    await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
      refreshScope: cid ? "one_contract" : "one_model",
      contractId: cid ?? undefined,
      reason: "evidence_review_mutation",
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
    revalidatePath("/contracts/evidence-studio");
    if (cid) revalidatePath(`/contracts/${cid}`);
        return {
          ...buildV10MutationResponse({
            outcome: auditEventId ? "success" : "audit_write_failed",
            message: auditEventId ? "Evidence rejected." : "Evidence was not rejected because audit confirmation failed.",
            changedObjectType: "evidence_request",
            changedObjectId: String(submission.requirement_id),
            nextDestinationHref: cid ? `/contracts/${cid}` : "/contracts/evidence-studio",
            auditEventId,
            diagnosticId: auditEventId ? null : "v10_evidence_reject_audit_missing",
          }),
          ok: true,
        };
      }

      return buildV10MutationResponse({
        outcome: "not_found",
        message: "Unsupported action.",
        diagnosticId: "v10_evidence_action_unsupported",
      });
    }
  );

  return jsonV10(mutation.response, mutation.replayed);
}
