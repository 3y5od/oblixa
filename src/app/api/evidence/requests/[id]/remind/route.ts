import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getApiAuthContext, canManageCapability } from "@/lib/v4/api-auth";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import {
  buildV10MutationResponse,
  buildV10MutationResponseInit,
} from "@/lib/v10-mutation-envelope";
import {
  recordV10AuditEvent,
} from "@/lib/v10-server-contracts";
import { refreshV10ReadModelsForOrganization } from "@/lib/v10-read-model-refresh";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

type EvidenceRequirementReminderRow = {
  id: string;
  organization_id: string;
  contract_id: string | null;
  title: string | null;
  status: string | null;
  due_at: string | null;
  reviewer_id: string | null;
};

function jsonV10(response: ReturnType<typeof buildV10MutationResponse>, status?: number) {
  return NextResponse.json(response, {
    ...buildV10MutationResponseInit(response, { headers: PRIVATE_NO_STORE_HEADERS }),
    status: status ?? statusForOutcome(response.outcome),
  });
}

function statusForOutcome(outcome: string) {
  if (outcome === "success" || outcome === "audit_write_failed") return 200;
  if (outcome === "conflict" || outcome === "stale_version") return 409;
  if (outcome === "validation_failed") return 400;
  if (outcome === "unauthorized") return 401;
  if (outcome === "forbidden") return 403;
  if (outcome === "not_found") return 404;
  return 500;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const routeParamRejection = rejectUnsafeRouteParams(
    { id },
    ["id"],
    "/api/evidence/requests/[id]/remind"
  );
  if (routeParamRejection) return routeParamRejection;

  const ctx = await getApiAuthContext();
  if (!ctx) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "unauthorized",
        message: "Not authenticated.",
        diagnosticId: "v10_evidence_reminder_unauthorized",
        nextDestinationHref: "/login",
      })
    );
  }
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "forbidden",
        message: "Access denied.",
        diagnosticId: "v10_evidence_reminder_forbidden",
        nextDestinationHref: "/contracts/evidence-studio",
      })
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/evidence/requests/[id]/remind",
    v10MutationResponse: true,
    nextDestinationHref: "/contracts/evidence-studio",
  });
  if (modeGate) return modeGate;

  const { data: requirement } = await ctx.admin
    .from("evidence_requirements")
    .select("id, organization_id, contract_id, title, status, due_at, reviewer_id")
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!requirement) {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "not_found",
        message: "Evidence request not found.",
        diagnosticId: "v10_evidence_reminder_not_found",
        nextDestinationHref: "/contracts/evidence-studio",
      })
    );
  }

  const row = requirement as EvidenceRequirementReminderRow;
  if (row.status === "approved" || row.status === "waived") {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "conflict",
        message: "This evidence request is already closed.",
        diagnosticId: "v10_evidence_reminder_closed",
        nextDestinationHref: row.contract_id ? `/contracts/${row.contract_id}` : "/contracts/evidence-studio",
      })
    );
  }

  const now = new Date().toISOString();
  const notificationRow = {
    organization_id: ctx.orgId,
    channel: "email",
    notification_type: "evidence_followup_owner",
    recipient: null,
    subject: "Evidence follow-up needed",
    status: "pending",
    next_attempt_at: now,
    metadata: {
      source_type: "evidence_requirement",
      source_id: row.id,
      contract_id: row.contract_id,
      user_id: row.reviewer_id,
      follow_up_stage: "manual",
      diagnostic_id: "v10_evidence_manual_reminder_requested",
      requested_by: ctx.userId,
    },
  };

  const { data: notification, error } = await ctx.admin
    .from("notification_deliveries")
    .insert(notificationRow)
    .select("id")
    .maybeSingle();
  if (error && error.code !== "23505") {
    return jsonV10(
      buildV10MutationResponse({
        outcome: "server_error",
        message: "Evidence reminder could not be queued.",
        diagnosticId: "v10_evidence_reminder_insert_failed",
      })
    );
  }

  const auditEventId = await recordV10AuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "evidence_request.follow_up_scheduled",
    targetType: "evidence_request",
    targetId: row.id,
    contractId: row.contract_id,
    outcome: "success",
    safeMetadata: {
      manual: true,
      duplicate_skipped: error?.code === "23505",
      notification_delivery_id: typeof notification?.id === "string" ? notification.id : null,
      due_state: row.due_at ? "provided" : "not_provided",
      reviewer_state: row.reviewer_id ? "provided" : "not_provided",
    },
  });
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.userId,
    contractId: row.contract_id,
    action: "product.v10.evidence_follow_up_scheduled",
    details: {
      manual: true,
      duplicate_skipped: error?.code === "23505",
      evidence_request_id: row.id,
    },
  });
  await refreshV10ReadModelsForOrganization(ctx.admin, ctx.orgId, {
    refreshScope: row.contract_id ? "one_contract" : "one_model",
    contractId: row.contract_id ?? undefined,
    reason: "evidence_manual_reminder",
    modelKeys: ["notification_deliveries", "work_items", "audit_events", "command_search_index"],
  });
  revalidatePath("/contracts/evidence-studio");
  if (row.contract_id) revalidatePath(`/contracts/${row.contract_id}`);

  return jsonV10(
    buildV10MutationResponse({
      outcome: auditEventId ? "success" : "audit_write_failed",
      message: error?.code === "23505" ? "Evidence reminder is already queued." : "Evidence reminder queued.",
      changedObjectType: "evidence_request",
      changedObjectId: row.id,
      nextDestinationHref: "/contracts/evidence-studio",
      auditEventId,
      diagnosticId: auditEventId ? undefined : "v10_evidence_reminder_audit_write_failed",
    })
  );
}
