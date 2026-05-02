import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { buildRenewalDecisionPacketPayload } from "@/lib/v4/renewal-decision-packet";
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
        diagnosticId: "v10_renewal_action_unauthorized",
        nextDestinationHref: "/login",
      })
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
      })
    );
  }

  const { data: checkpoint } = await ctx.admin
    .from("contract_renewal_checkpoints")
    .select(
      "id, contract_id, organization_id, label, due_date, status, workspace_json, renewal_state, scenario_id, updated_at"
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
      })
    );
  }

  if (action === "complete" || action === "reopen") {
    const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as { note?: string };
    const completed = action === "complete";
    const nextStatus = completed ? "completed" : "open";
    const nextRenewalState = completed ? "completed" : "plan";
    const auditAction = completed ? "renewal_checkpoint.completed" : "renewal_checkpoint.reopened";
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
        currentVersion: checkpoint.updated_at ?? checkpoint.renewal_state ?? checkpoint.status,
        payload: { action, note_state: body.note?.trim() ? "provided" : "not_provided" },
      },
      async () => {
        const { error } = await ctx.admin
          .from("contract_renewal_checkpoints")
          .update({
            status: nextStatus,
            renewal_state: nextRenewalState,
            notes: body.note?.trim() || null,
            completed_at: completed ? new Date().toISOString() : null,
          })
          .eq("id", checkpoint.id)
          .eq("organization_id", ctx.orgId);
        if (error) {
          return buildV10MutationResponse({
            outcome: "server_error",
            message: "Renewal checkpoint could not be updated.",
            diagnosticId: "v10_renewal_checkpoint_update_failed",
          });
        }
        await appendCasefileEvent({
          admin: ctx.admin,
          organizationId: ctx.orgId,
          contractId: checkpoint.contract_id,
          eventType: auditAction,
          entityType: "renewal_checkpoint",
          entityId: checkpoint.id,
          actorUserId: ctx.userId,
          details: { note_state: body.note?.trim() ? "provided" : "not_provided" },
        });
        await emitProductTelemetryEvent(ctx.admin, {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          contractId: checkpoint.contract_id,
          action: completed ? "product.v10.renewal_checkpoint_completed" : "product.v10.renewal_checkpoint_reopened",
          details: { checkpoint_id: checkpoint.id, note_state: body.note?.trim() ? "provided" : "not_provided" },
        });
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: auditAction,
          targetType: "renewal_checkpoint",
          targetId: checkpoint.id,
          contractId: checkpoint.contract_id,
          outcome: "success",
          beforeStateHash: String(checkpoint.renewal_state ?? checkpoint.status ?? "pending"),
          afterStateHash: nextRenewalState,
          safeMetadata: { note_state: body.note?.trim() ? "provided" : "not_provided" },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: checkpoint.contract_id ? "one_contract" : "one_model",
          contractId: (checkpoint.contract_id as string | null) ?? undefined,
          reason: "renewal_mutation",
          modelKeys: [
            "work_items",
            "contract_health_snapshots",
            "contract_activity_events",
            "renewal_posture_snapshots",
            "renewal_checkpoint_records",
            "audit_events",
            "command_search_index",
          ],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? (completed ? "Renewal checkpoint completed." : "Renewal checkpoint reopened.") : "Renewal checkpoint was not updated because audit confirmation failed.",
          changedObjectType: "renewal_checkpoint",
          changedObjectId: checkpoint.id,
          nextDestinationHref: `/contracts/${checkpoint.contract_id}?tab=overview#renewal-checkpoints`,
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_renewal_checkpoint_audit_missing",
        });
      }
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
        currentVersion: checkpoint.updated_at ?? checkpoint.renewal_state ?? checkpoint.status,
        payload: {
          action,
          summary_state: payload.summary?.trim() ? "provided" : "not_provided",
          assumptions_state: payload.assumptions ? "provided" : "not_provided",
        },
      },
      async () => {
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
          assumptionsFromRequest: payload.assumptions ?? null,
        });
        const { data: packet, error } = await ctx.admin
          .from("renewal_decision_packets")
          .insert({
            organization_id: ctx.orgId,
            contract_id: checkpoint.contract_id,
            checkpoint_id: checkpoint.id,
            status: "draft",
            summary: payload.summary?.trim() || null,
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
          .update({ decision_packet_id: packet.id, renewal_state: "under_review" })
          .eq("id", checkpoint.id)
          .eq("organization_id", ctx.orgId);

        await appendCasefileEvent({
          admin: ctx.admin,
          organizationId: ctx.orgId,
          contractId: checkpoint.contract_id,
          eventType: "renewal.decision_packet_generated",
          entityType: "renewal_decision_packet",
          entityId: packet.id,
          actorUserId: ctx.userId,
        });
        await emitProductTelemetryEvent(ctx.admin, {
          organizationId: ctx.orgId,
          userId: ctx.userId,
          contractId: checkpoint.contract_id,
          action: "product.v10.renewal_decision_packet_generated",
          details: {
            checkpoint_id: checkpoint.id,
            summary_state: payload.summary?.trim() ? "provided" : "not_provided",
            assumptions_state: payload.assumptions ? "provided" : "not_provided",
          },
        });
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "renewal.decision_packet_generated",
          targetType: "renewal_checkpoint",
          targetId: checkpoint.id,
          contractId: checkpoint.contract_id,
          outcome: "success",
          beforeStateHash: String(checkpoint.renewal_state ?? checkpoint.status ?? "pending"),
          afterStateHash: "under_review",
          safeMetadata: { packet_generated: true, summary_state: payload.summary?.trim() ? "provided" : "not_provided" },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: checkpoint.contract_id ? "one_contract" : "one_model",
          contractId: (checkpoint.contract_id as string | null) ?? undefined,
          reason: "renewal_mutation",
          modelKeys: [
            "work_items",
            "contract_health_snapshots",
            "contract_activity_events",
            "renewal_posture_snapshots",
            "renewal_checkpoint_records",
            "audit_events",
            "command_search_index",
          ],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Decision packet generated." : "Decision packet was not generated because audit confirmation failed.",
          changedObjectType: "renewal_checkpoint",
          changedObjectId: checkpoint.id,
          nextDestinationHref: `/contracts/${checkpoint.contract_id}?tab=overview#renewal-decision`,
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_renewal_packet_audit_missing",
        });
      }
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
        currentVersion: checkpoint.updated_at ?? checkpoint.renewal_state ?? checkpoint.status,
        payload: { action, packet_id: packetId, recommendation: body.recommendation ?? null },
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
            summary: body.summary?.trim() || null,
            status: "recommended",
          })
          .eq("id", packetId)
          .eq("organization_id", ctx.orgId)
          .eq("checkpoint_id", checkpoint.id)
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
          .eq("id", checkpoint.id)
          .eq("organization_id", ctx.orgId);

        await appendCasefileEvent({
          admin: ctx.admin,
          organizationId: ctx.orgId,
          contractId: checkpoint.contract_id,
          eventType: "renewal.recommendation_updated",
          entityType: "renewal_decision_packet",
          entityId: packetId,
          actorUserId: ctx.userId,
          details: { recommendation: body.recommendation ?? null },
        });
        const auditEventId = await recordV10AuditEvent(ctx.admin, {
          organizationId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "renewal.recommendation_updated",
          targetType: "renewal_checkpoint",
          targetId: checkpoint.id,
          contractId: checkpoint.contract_id,
          outcome: "success",
          beforeStateHash: String(checkpoint.renewal_state ?? checkpoint.status ?? "pending"),
          afterStateHash: "decision_pending",
          safeMetadata: { recommendation_state: body.recommendation ? "provided" : "not_provided" },
        });
        await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
          refreshScope: checkpoint.contract_id ? "one_contract" : "one_model",
          contractId: (checkpoint.contract_id as string | null) ?? undefined,
          reason: "renewal_mutation",
          modelKeys: [
            "work_items",
            "contract_health_snapshots",
            "contract_activity_events",
            "renewal_posture_snapshots",
            "renewal_checkpoint_records",
            "audit_events",
            "command_search_index",
          ],
        });
        return buildV10MutationResponse({
          outcome: auditEventId ? "success" : "audit_write_failed",
          message: auditEventId ? "Recommendation updated." : "Recommendation was not updated because audit confirmation failed.",
          changedObjectType: "renewal_checkpoint",
          changedObjectId: checkpoint.id,
          nextDestinationHref: `/contracts/${checkpoint.contract_id}?tab=overview#renewal-decision`,
          auditEventId,
          diagnosticId: auditEventId ? null : "v10_renewal_recommendation_audit_missing",
        });
      }
    );
    return jsonV10(mutation.response, mutation.replayed);
  }

  return jsonV10(
    buildV10MutationResponse({
      outcome: "not_found",
      message: "Unsupported action.",
      diagnosticId: "v10_renewal_action_unsupported",
    })
  );
}
