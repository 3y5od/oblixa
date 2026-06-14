import { appendCasefileEvent } from "@/lib/contract-operations/casefile";
import type { AuthContext } from "@/lib/contract-operations/api-auth";
import {
  buildV10MutationResponse,
  type V10MutationResponse,
} from "@/lib/mutation-envelope";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import type { AuditAction } from "@/lib/security/audit-actions";
import type { V10AuditMetadata } from "@/lib/server-contracts";

export type ApprovalDecisionAction = "approve" | "reject" | "request-changes";

type RecordAuditEvent =
  typeof import("@/lib/server-contracts").recordV10AuditEvent;
type RefreshReadModelsForOrganization =
  typeof import("@/lib/read-model-refresh").refreshV10ReadModelsForOrganization;

export type ApprovalActionDependencies = {
  recordAuditEvent: RecordAuditEvent;
  refreshReadModelsForOrganization: RefreshReadModelsForOrganization;
};

export type ApprovalActionBody = {
  note?: string;
  delegateUserId?: string;
};

export type ApprovalActionRow = {
  id: string;
  organization_id: string;
  status: string | null;
  contract_id: string;
  updated_at?: string | null;
};

type ProductTelemetryDetails = Record<string, string | number | boolean | null>;

const APPROVAL_READ_MODEL_KEYS = [
  "work_items",
  "contract_health_snapshots",
  "contract_activity_events",
  "approval_records",
  "audit_events",
  "command_search_index",
] as const;

export function trimApprovalNote(note: string | undefined): string | null {
  return note?.trim() || null;
}

export function approvalNoteState(note: string | null) {
  return note ? "provided" : "not_provided";
}

export function buildApprovalDecisionConfig(action: ApprovalDecisionAction) {
  if (action === "approve") {
    return {
      nextStatus: "approved",
      eventType: "approved",
      auditAction: "approval.approved",
      message: "Approval approved.",
    } as const;
  }
  if (action === "reject") {
    return {
      nextStatus: "rejected",
      eventType: "rejected",
      auditAction: "approval.rejected",
      message: "Approval rejected.",
    } as const;
  }
  return {
    nextStatus: "changes_requested",
    eventType: "changes_requested",
    auditAction: "approval.changes_requested",
    message: "Changes requested.",
  } as const;
}

export async function validateApprovalDelegateUser(
  ctx: AuthContext,
  delegateUserId: string,
): Promise<V10MutationResponse | null> {
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
  return null;
}

export async function buildApprovalActionSuccessResponse(input: {
  ctx: AuthContext;
  approval: ApprovalActionRow;
  id: string;
  dependencies: ApprovalActionDependencies;
  approvalEventType: string;
  approvalEventDetails: Record<string, unknown>;
  auditAction: AuditAction;
  auditAfterStateHash: string;
  auditSafeMetadata: V10AuditMetadata;
  telemetryDetails: ProductTelemetryDetails;
  message: string;
  auditMissingMessage: string;
  auditMissingDiagnosticId: string;
}): Promise<V10MutationResponse> {
  const { ctx, approval, id } = input;
  await ctx.admin.from("contract_approval_events").insert({
    organization_id: ctx.orgId,
    contract_id: approval.contract_id,
    approval_id: id,
    actor_id: ctx.userId,
    event_type: input.approvalEventType,
    details: input.approvalEventDetails,
  });
  await appendCasefileEvent({
    admin: ctx.admin,
    organizationId: ctx.orgId,
    contractId: approval.contract_id,
    eventType: input.auditAction,
    entityType: "approval",
    entityId: id,
    actorUserId: ctx.userId,
    details: input.approvalEventDetails,
  });
  const auditEventId = await input.dependencies.recordAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: input.auditAction,
    targetType: "approval",
    targetId: id,
    contractId: approval.contract_id,
    outcome: "success",
    beforeStateHash: String(approval.status ?? "pending"),
    afterStateHash: input.auditAfterStateHash,
    safeMetadata: input.auditSafeMetadata,
  });
  await emitProductTelemetryEvent(ctx.admin, {
    organizationId: ctx.orgId,
    userId: ctx.userId,
    contractId: approval.contract_id,
    action: "product.v10.approval_decision_recorded",
    details: input.telemetryDetails,
  });
  await input.dependencies.refreshReadModelsForOrganization(
    ctx.admin,
    ctx.orgId,
    {
      refreshScope: approval.contract_id ? "one_contract" : "one_model",
      contractId: approval.contract_id ?? undefined,
      reason: "approval_mutation",
      modelKeys: APPROVAL_READ_MODEL_KEYS,
    },
  );
  return buildV10MutationResponse({
    outcome: auditEventId ? "success" : "audit_write_failed",
    message: auditEventId ? input.message : input.auditMissingMessage,
    changedObjectType: "approval",
    changedObjectId: id,
    nextDestinationHref: `/contracts/${approval.contract_id}?tab=overview#renewal-approvals`,
    auditEventId,
    diagnosticId: auditEventId ? null : input.auditMissingDiagnosticId,
  });
}
