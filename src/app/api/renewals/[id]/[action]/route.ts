import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import {
  getApiAuthContext,
  canManageCapability,
} from "@/lib/contract-operations/api-auth";
import { buildRenewalDecisionPacketPayload } from "@/lib/contract-operations/renewal-decision-packet";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import {
  buildRenewalActionSuccessResponse,
  buildRenewalCheckpointToggleConfig,
  providedState,
  trimRenewalText,
  type RenewalCheckpointRow,
} from "@/lib/renewals/action-route";
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
import {
  rejectInvalidRouteParamEnums,
  rejectUnsafeRouteParams,
} from "@/lib/security/route-params";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const RENEWAL_ACTIONS = [
  "complete",
  "reopen",
  "generate-decision-packet",
  "recommendation",
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
    "/api/renewals/[id]/[action]",
  );
  if (routeParamRejection) return routeParamRejection;
  const routeActionRejection = rejectInvalidRouteParamEnums(
    { action },
    { action: RENEWAL_ACTIONS },
    "/api/renewals/[id]/[action]",
  );
  if (routeActionRejection) return routeActionRejection;
  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_renewal_action_unauthorized",
        nextDestinationHref: "/login",
      }),
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/renewals/[id]/[action]",
    v10MutationResponse: true,
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "renewals_manage"))) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "forbidden",
        message: "Access denied.",
        diagnosticId: "v10_renewal_action_forbidden",
      }),
    );
  }

  const { data: checkpoint } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .select(
      "id, contract_id, organization_id, label, due_date, status, workspace_json, renewal_state, scenario_id, updated_at",
    )
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!checkpoint) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "not_found",
        message: "Renewal checkpoint not found.",
        diagnosticId: "v10_renewal_checkpoint_not_found",
      }),
    );
  }
  const checkpointRow = checkpoint as RenewalCheckpointRow;
  const dependencies = {
    recordAuditEvent: recordV10AuditEvent,
    refreshReadModelsForOrganization: refreshV10ReadModelsForOrganization,
  };

  if (action === "complete" || action === "reopen") {
    const _lb_body = await readJsonBodyLimited(request);
    if (!_lb_body.ok) return _lb_body.response;
    const body = (_lb_body.body ?? {}) as { note?: string };
    const note = trimRenewalText(body.note);
    const noteState = providedState(note);
    const actionConfig = buildRenewalCheckpointToggleConfig(action);
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: `renewal.${action}`,
        targetType: "renewal_checkpoint",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion:
          checkpointRow.updated_at ??
          checkpointRow.renewal_state ??
          checkpointRow.status,
        payload: { action, note_state: noteState },
      },
      async () => {
        const { error } = await ctx.admin
          .from("contract_renewal_checkpoints")
          .update({
            status: actionConfig.nextStatus,
            renewal_state: actionConfig.nextRenewalState,
            notes: note,
            completed_at: actionConfig.completed
              ? new Date().toISOString()
              : null,
          })
          .eq("id", checkpointRow.id)
          .eq("organization_id", ctx.orgId);
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Renewal checkpoint could not be updated.",
            diagnosticId: "v10_renewal_checkpoint_update_failed",
          });
        }

        return buildRenewalActionSuccessResponse({
          ctx,
          checkpoint: checkpointRow,
          dependencies,
          casefileEventType: actionConfig.auditAction,
          casefileEntityType: "renewal_checkpoint",
          casefileEntityId: checkpointRow.id,
          casefileDetails: { note_state: noteState },
          auditAction: actionConfig.auditAction,
          auditAfterStateHash: actionConfig.nextRenewalState,
          auditSafeMetadata: { note_state: noteState },
          telemetry: {
            action: actionConfig.telemetryAction,
            details: { checkpoint_id: checkpointRow.id, note_state: noteState },
          },
          message: actionConfig.message,
          auditMissingMessage:
            "Renewal checkpoint was not updated because audit confirmation failed.",
          auditMissingDiagnosticId: "v10_renewal_checkpoint_audit_missing",
          nextDestinationHref: `/contracts/${checkpointRow.contract_id}?tab=overview#renewal-checkpoints`,
        });
      },
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "generate-decision-packet") {
    const _lb_payload = await readJsonBodyLimited(request);
    if (!_lb_payload.ok) return _lb_payload.response;
    const payload = (_lb_payload.body ?? {}) as {
      assumptions?: Record<string, unknown>;
      summary?: string;
    };
    const summary = trimRenewalText(payload.summary);
    const summaryState = providedState(summary);
    const assumptionsState = providedState(payload.assumptions);
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "renewal.generate_decision_packet",
        targetType: "renewal_checkpoint",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion:
          checkpointRow.updated_at ??
          checkpointRow.renewal_state ??
          checkpointRow.status,
        payload: {
          action,
          summary_state: summaryState,
          assumptions_state: assumptionsState,
        },
      },
      async () => {
        const scenarioId = checkpointRow.scenario_id as
          | string
          | null
          | undefined;
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
            .select(
              "id, scenario, workspace_status, target_decision_date, decision_date",
            )
            .eq("id", scenarioId)
            .eq("organization_id", ctx.orgId)
            .maybeSingle();
          if (s) scenarioRow = s;
        }
        const { packet_json, assumptions_json } =
          buildRenewalDecisionPacketPayload({
            checkpoint: {
              label: checkpointRow.label,
              due_date: checkpointRow.due_date,
              status: checkpointRow.status,
              renewal_state: checkpointRow.renewal_state,
              workspace_json: checkpointRow.workspace_json,
            },
            scenarioRow,
            assumptionsFromRequest: payload.assumptions ?? null,
          });
        const { data: packet, error } = await ctx.admin
          .from("renewal_decision_packets")
          .insert({
            organization_id: ctx.orgId,
            contract_id: checkpointRow.contract_id,
            checkpoint_id: checkpointRow.id,
            status: "draft",
            summary,
            assumptions_json,
            packet_json,
            generated_by: ctx.userId,
            generated_at: new Date().toISOString(),
          })
          .select("id, status, summary, created_at")
          .single();
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: error.message,
            diagnosticId: "v10_renewal_packet_insert_failed",
          });
        }

        await ctx.admin
          .from("contract_renewal_checkpoints")
          .update({
            decision_packet_id: packet.id,
            renewal_state: "under_review",
          })
          .eq("id", checkpointRow.id)
          .eq("organization_id", ctx.orgId);

        return buildRenewalActionSuccessResponse({
          ctx,
          checkpoint: checkpointRow,
          dependencies,
          casefileEventType: "renewal.decision_packet_generated",
          casefileEntityType: "renewal_decision_packet",
          casefileEntityId: packet.id,
          auditAction: "renewal.decision_packet_generated",
          auditAfterStateHash: "under_review",
          auditSafeMetadata: {
            packet_generated: true,
            summary_state: summaryState,
          },
          telemetry: {
            action: "product.v10.renewal_decision_packet_generated",
            details: {
              checkpoint_id: checkpointRow.id,
              summary_state: summaryState,
              assumptions_state: assumptionsState,
            },
          },
          message: "Decision packet generated.",
          auditMissingMessage:
            "Decision packet was not generated because audit confirmation failed.",
          auditMissingDiagnosticId: "v10_renewal_packet_audit_missing",
          nextDestinationHref: `/contracts/${checkpointRow.contract_id}?tab=overview#renewal-decision`,
        });
      },
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  if (action === "recommendation") {
    const _lb_body = await readJsonBodyLimited(request);
    if (!_lb_body.ok) return _lb_body.response;
    const body = (_lb_body.body ?? {}) as {
      packetId?: string;
      recommendation?: "renew" | "amend" | "terminate";
      summary?: string;
    };
    const packetId = String(body.packetId ?? "").trim();
    const summary = trimRenewalText(body.summary);
    const recommendationState = providedState(body.recommendation);
    const mutation = await executeV10IdempotentMutation(
      ctx.admin,
      {
        organizationId: ctx.orgId,
        actorUserId: ctx.userId,
        mutationName: "renewal.recommendation",
        targetType: "renewal_checkpoint",
        targetId: id,
        idempotencyKey: getV10IdempotencyKeyFromRequest(request),
        expectedVersion: getV10ExpectedVersionFromRequest(request),
        currentVersion:
          checkpointRow.updated_at ??
          checkpointRow.renewal_state ??
          checkpointRow.status,
        payload: {
          action,
          packet_id: packetId,
          recommendation: body.recommendation ?? null,
        },
      },
      async () => {
        if (!packetId) {
          return buildV10MutationResponse({
            outcome: "validation_failed",
            message: "packetId is required.",
            diagnosticId: "v10_renewal_packet_id_required",
            validationFailures: [
              {
                field: "packetId",
                code: "required",
                user_visible_message: "Choose a decision packet.",
                self_fixable: true,
              },
            ],
          });
        }
        const { data: updatedPacket, error } = await ctx.admin
          .from("renewal_decision_packets")
          .update({
            recommendation: body.recommendation ?? null,
            summary,
            status: "recommended",
          })
          .eq("id", packetId)
          .eq("organization_id", ctx.orgId)
          .eq("checkpoint_id", checkpointRow.id)
          .select("id");
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: error.message,
            diagnosticId: "v10_renewal_recommendation_update_failed",
          });
        }
        if (!updatedPacket || updatedPacket.length === 0) {
          return buildV10MutationResponse({
            outcome: "not_found",
            message: "Decision packet not found.",
            diagnosticId: "v10_renewal_packet_not_found",
          });
        }

        await ctx.admin
          .from("contract_renewal_checkpoints")
          .update({ renewal_state: "decision_pending" })
          .eq("id", checkpointRow.id)
          .eq("organization_id", ctx.orgId);

        return buildRenewalActionSuccessResponse({
          ctx,
          checkpoint: checkpointRow,
          dependencies,
          casefileEventType: "renewal.recommendation_updated",
          casefileEntityType: "renewal_decision_packet",
          casefileEntityId: packetId,
          casefileDetails: { recommendation: body.recommendation ?? null },
          auditAction: "renewal.recommendation_updated",
          auditAfterStateHash: "decision_pending",
          auditSafeMetadata: { recommendation_state: recommendationState },
          message: "Recommendation updated.",
          auditMissingMessage:
            "Recommendation was not updated because audit confirmation failed.",
          auditMissingDiagnosticId: "v10_renewal_recommendation_audit_missing",
          nextDestinationHref: `/contracts/${checkpointRow.contract_id}?tab=overview#renewal-decision`,
        });
      },
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  return jsonV10(
    buildV10MutationResponse({
      outcome: "not_found",
      message: "Unsupported action.",
      diagnosticId: "v10_renewal_action_unsupported",
    }),
  );
}
