"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isUuid } from "@/lib/security/validation";
import type { ApprovalStatus, ApprovalType, RenewalScenario } from "@/lib/types";

const APPROVAL_TYPES: ApprovalType[] = [
  "renewal_decision",
  "notice_action",
  "commercial_exception",
  "ownership_handoff",
];
const APPROVAL_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected"];
const RENEWAL_SCENARIOS: RenewalScenario[] = [
  "renew",
  "renegotiate",
  "terminate",
  "temporary_extension",
  "awaiting_decision",
];

const MAX_NOTE_LEN = 4000;

export async function requestContractApproval(input: {
  contractId: string;
  approvalType: ApprovalType;
  approverId?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  if (!APPROVAL_TYPES.includes(input.approvalType)) return { error: "Invalid approval type" };

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > MAX_NOTE_LEN) return { error: "Notes are too long" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id, contract_type, annual_value")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot request approvals." };

  let approverId = input.approverId?.trim() || null;
  if (approverId && !isUuid(approverId)) return { error: "Invalid approver" };

  const { data: policies } = await admin
    .from("approval_policies")
    .select("required_approver_id, min_annual_value, contract_type")
    .eq("organization_id", contract.organization_id)
    .eq("approval_type", input.approvalType)
    .eq("active", true);

  const matchingPolicy = (policies ?? []).find((policy) => {
    const typeMatches =
      !policy.contract_type || policy.contract_type === contract.contract_type;
    const valueMatches =
      policy.min_annual_value == null ||
      Number(contract.annual_value ?? 0) >= Number(policy.min_annual_value);
    return typeMatches && valueMatches;
  });
  if (matchingPolicy?.required_approver_id) {
    approverId = matchingPolicy.required_approver_id;
  }

  const { data: approval, error } = await admin
    .from("contract_approvals")
    .insert({
      contract_id: input.contractId,
      organization_id: contract.organization_id,
      approval_type: input.approvalType,
      requested_by: user.id,
      approver_id: approverId,
      notes,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { error: mapDataSourceError(error.message) };

  if (approverId) {
    await admin.from("internal_notifications").insert({
      organization_id: contract.organization_id,
      user_id: approverId,
      notification_type: "approval_requested",
      title: "Approval requested",
      body: notes ?? "A contract approval request is waiting for review.",
      entity_type: "contract_approval",
      entity_id: approval.id,
    });
  }

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "approval.requested",
    details: { approval_id: approval.id, approval_type: input.approvalType, approver_id: approverId },
  });
  await admin.from("contract_notes").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    author_id: user.id,
    note: `[Timeline] Approval requested (${input.approvalType})`,
    pinned: false,
  });

  return { success: true as const, approvalId: approval.id };
}

export async function requestContractApprovalForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const approvalType = String(formData.get("approvalType") ?? "").trim();
  const approverId = String(formData.get("approverId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const res = await requestContractApproval({
    contractId,
    approvalType: approvalType as ApprovalType,
    approverId: approverId || null,
    notes: notes || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] requestContractApprovalForm", res.error);
  }
}

export async function updateContractApprovalStatus(input: {
  approvalId: string;
  status: ApprovalStatus;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.approvalId)) return { error: "Invalid approval" };
  if (!APPROVAL_STATUSES.includes(input.status)) return { error: "Invalid status" };

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > MAX_NOTE_LEN) return { error: "Notes are too long" };

  const { data: approval } = await admin
    .from("contract_approvals")
    .select("id, contract_id, organization_id, approver_id")
    .eq("id", input.approvalId)
    .maybeSingle();
  if (!approval) return { error: "Approval not found" };

  const role = await getOrgMemberRole(admin, user.id, approval.organization_id);
  const canResolve = canEditContracts(role) || approval.approver_id === user.id;
  if (!canResolve) return { error: "Access denied" };

  const { error } = await admin
    .from("contract_approvals")
    .update({
      status: input.status,
      notes,
      resolved_at: input.status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", input.approvalId);
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: approval.organization_id,
    contract_id: approval.contract_id,
    user_id: user.id,
    action: "approval.updated",
    details: { approval_id: input.approvalId, status: input.status },
  });

  await admin.from("contract_notes").insert({
    contract_id: approval.contract_id,
    organization_id: approval.organization_id,
    author_id: user.id,
    note: `[Timeline] Approval ${input.status}: ${input.approvalId}`,
    pinned: false,
  });

  return { success: true as const };
}

export async function updateContractApprovalStatusForm(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const res = await updateContractApprovalStatus({
    approvalId,
    status: status as ApprovalStatus,
    notes: notes || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] updateContractApprovalStatusForm", res.error);
  }
}

export async function upsertRenewalScenario(input: {
  contractId: string;
  scenario: RenewalScenario;
  decisionNotes?: string | null;
  blocker?: string | null;
}) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(input.contractId)) return { error: "Invalid contract" };
  if (!RENEWAL_SCENARIOS.includes(input.scenario)) return { error: "Invalid scenario" };

  const decisionNotes = input.decisionNotes?.trim() || null;
  const blocker = input.blocker?.trim() || null;
  if (decisionNotes && decisionNotes.length > MAX_NOTE_LEN) return { error: "Decision notes are too long" };
  if (blocker && blocker.length > 800) return { error: "Blocker is too long" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", input.contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) return { error: "Viewers cannot update renewal scenarios." };

  const { error } = await admin
    .from("contract_renewal_scenarios")
    .upsert(
      {
        contract_id: input.contractId,
        organization_id: contract.organization_id,
        scenario: input.scenario,
        decision_notes: decisionNotes,
        blocker,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "contract_id", ignoreDuplicates: false }
    );
  if (error) return { error: mapDataSourceError(error.message) };

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: input.contractId,
    user_id: user.id,
    action: "renewal.scenario_updated",
    details: { scenario: input.scenario, blocker },
  });
  await admin.from("contract_notes").insert({
    contract_id: input.contractId,
    organization_id: contract.organization_id,
    author_id: user.id,
    note: `[Timeline] Renewal scenario set to ${input.scenario}${blocker ? ` (blocker: ${blocker})` : ""}`,
    pinned: false,
  });

  return { success: true as const };
}

export async function upsertRenewalScenarioForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const scenario = String(formData.get("scenario") ?? "").trim();
  const blocker = String(formData.get("blocker") ?? "").trim();
  const decisionNotes = String(formData.get("decisionNotes") ?? "").trim();
  const res = await upsertRenewalScenario({
    contractId,
    scenario: scenario as RenewalScenario,
    blocker: blocker || null,
    decisionNotes: decisionNotes || null,
  });
  if (res && "error" in res && res.error) {
    console.error("[approvals] upsertRenewalScenarioForm", res.error);
  }
}
