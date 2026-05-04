import { revalidatePath } from "next/cache";
import { hasOrgCapability } from "@/lib/actions/access";
import { createAdminClient } from "@/lib/supabase/server";
import { buildV10MutationResponse } from "@/lib/v10-mutation-envelope";
import type { ApprovalStatus } from "@/lib/types";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export function revalidateApprovalPaths(contractId: string) {
  revalidatePath("/work");
  revalidatePath("/contracts/approvals");
  revalidatePath("/contracts/approvals/workload");
  revalidatePath("/contracts/approvals/sla-simulator");
  revalidatePath(`/contracts/${contractId}`);
}

export function approvalAuditActionForStatus(status: Exclude<ApprovalStatus, "pending">) {
  if (status === "approved") return "approval.approved";
  if (status === "rejected") return "approval.rejected";
  return "approval.changes_requested";
}

export function approvalDecisionMessage(status: Exclude<ApprovalStatus, "pending">) {
  if (status === "approved") return "Approval approved.";
  if (status === "rejected") return "Approval rejected.";
  return "Approval changes requested.";
}

export function buildApprovalMutationEnvelope(input: {
  outcome: "success" | "audit_write_failed";
  message: string;
  approvalId: string;
  contractId: string;
  auditEventId: string | null;
}) {
  return buildV10MutationResponse({
    outcome: input.outcome,
    message: input.message,
    changedObjectType: "approval",
    changedObjectId: input.approvalId,
    nextDestinationHref: `/contracts/${input.contractId}?tab=overview#renewal-approvals`,
    auditEventId: input.auditEventId,
    diagnosticId: input.outcome === "audit_write_failed" ? "v10_approval_audit_missing" : null,
  });
}

export async function appendApprovalEvent(
  admin: Admin,
  input: {
    organizationId: string;
    contractId: string;
    approvalId: string;
    actorId: string | null;
    eventType: "requested" | "status_changed" | "delegated" | "escalated" | "exception_logged";
    details?: Record<string, unknown>;
  }
) {
  await admin.from("contract_approval_events").insert({
    organization_id: input.organizationId,
    contract_id: input.contractId,
    approval_id: input.approvalId,
    actor_id: input.actorId,
    event_type: input.eventType,
    details: input.details ?? {},
  });
}

export async function canManageApprovalsForOrg(admin: Admin, organizationId: string, userId: string) {
  return await hasOrgCapability({
    admin,
    organizationId,
    userId,
    capability: "approvals_manage",
    allowContractEditors: true,
  });
}