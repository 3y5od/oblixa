import { appendCasefileEvent } from "@/lib/contract-operations/casefile";
import type { AuthContext } from "@/lib/contract-operations/api-auth";
import {
  buildV10MutationResponse,
  type V10MutationResponse,
} from "@/lib/mutation-envelope";
import { emitProductTelemetryEvent } from "@/lib/product-telemetry";
import type { AuditAction } from "@/lib/security/audit-actions";
import type { V10AuditMetadata } from "@/lib/server-contracts";

type RecordAuditEvent =
  typeof import("@/lib/server-contracts").recordV10AuditEvent;
type RefreshReadModelsForOrganization =
  typeof import("@/lib/read-model-refresh").refreshV10ReadModelsForOrganization;

export type RenewalActionDependencies = {
  recordAuditEvent: RecordAuditEvent;
  refreshReadModelsForOrganization: RefreshReadModelsForOrganization;
};

export type RenewalCheckpointRow = {
  id: string;
  contract_id: string;
  organization_id: string;
  label: string | null;
  due_date: string | null;
  status: string | null;
  workspace_json: unknown;
  renewal_state: string | null;
  scenario_id?: string | null;
  updated_at?: string | null;
};

type ProductTelemetryDetails = Record<string, string | number | boolean | null>;

const RENEWAL_READ_MODEL_KEYS = [
  "work_items",
  "contract_health_snapshots",
  "contract_activity_events",
  "renewal_posture_snapshots",
  "renewal_checkpoint_records",
  "audit_events",
  "command_search_index",
] as const;

export function trimRenewalText(value: string | undefined): string | null {
  return value?.trim() || null;
}

export function providedState(value: unknown) {
  return value ? "provided" : "not_provided";
}

export function buildRenewalCheckpointToggleConfig(
  action: "complete" | "reopen",
) {
  const completed = action === "complete";
  return {
    completed,
    nextStatus: completed ? "completed" : "open",
    nextRenewalState: completed ? "completed" : "plan",
    auditAction: completed
      ? "renewal_checkpoint.completed"
      : "renewal_checkpoint.reopened",
    telemetryAction: completed
      ? "product.v10.renewal_checkpoint_completed"
      : "product.v10.renewal_checkpoint_reopened",
    message: completed
      ? "Renewal checkpoint completed."
      : "Renewal checkpoint reopened.",
  } as const;
}

export async function buildRenewalActionSuccessResponse(input: {
  ctx: AuthContext;
  checkpoint: RenewalCheckpointRow;
  dependencies: RenewalActionDependencies;
  casefileEventType: string;
  casefileEntityType: string;
  casefileEntityId: string;
  casefileDetails?: Record<string, unknown>;
  auditAction: AuditAction;
  auditAfterStateHash: string;
  auditSafeMetadata: V10AuditMetadata;
  telemetry?: {
    action: string;
    details: ProductTelemetryDetails;
  };
  message: string;
  auditMissingMessage: string;
  auditMissingDiagnosticId: string;
  nextDestinationHref: string;
}): Promise<V10MutationResponse> {
  const { ctx, checkpoint } = input;
  await appendCasefileEvent({
    admin: ctx.admin,
    organizationId: ctx.orgId,
    contractId: checkpoint.contract_id,
    eventType: input.casefileEventType,
    entityType: input.casefileEntityType,
    entityId: input.casefileEntityId,
    actorUserId: ctx.userId,
    details: input.casefileDetails,
  });
  if (input.telemetry) {
    await emitProductTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.userId,
      contractId: checkpoint.contract_id,
      action: input.telemetry.action,
      details: input.telemetry.details,
    });
  }
  const auditEventId = await input.dependencies.recordAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    action: input.auditAction,
    targetType: "renewal_checkpoint",
    targetId: checkpoint.id,
    contractId: checkpoint.contract_id,
    outcome: "success",
    beforeStateHash: String(
      checkpoint.renewal_state ?? checkpoint.status ?? "pending",
    ),
    afterStateHash: input.auditAfterStateHash,
    safeMetadata: input.auditSafeMetadata,
  });
  await input.dependencies.refreshReadModelsForOrganization(
    ctx.admin,
    ctx.orgId,
    {
      refreshScope: checkpoint.contract_id ? "one_contract" : "one_model",
      contractId: checkpoint.contract_id ?? undefined,
      reason: "renewal_mutation",
      modelKeys: RENEWAL_READ_MODEL_KEYS,
    },
  );
  return buildV10MutationResponse({
    outcome: auditEventId ? "success" : "audit_write_failed",
    message: auditEventId ? input.message : input.auditMissingMessage,
    changedObjectType: "renewal_checkpoint",
    changedObjectId: checkpoint.id,
    nextDestinationHref: input.nextDestinationHref,
    auditEventId,
    diagnosticId: auditEventId ? null : input.auditMissingDiagnosticId,
  });
}
