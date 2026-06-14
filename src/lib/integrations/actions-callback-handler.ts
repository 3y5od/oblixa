import { jsonOk } from "@/lib/http/problem";
import { isUuid } from "@/lib/security/validation";
import type { createAdminClient } from "@/lib/supabase/server";

export type IntegrationCallbackAction =
  | "create_task"
  | "create_exception"
  | "ack_complete"
  | "approve_evidence"
  | "reject_evidence"
  | "delegate_approval"
  | "resolve_exception";

export type IntegrationCallbackBody = {
  organizationId?: string;
  action?: IntegrationCallbackAction;
  title?: string;
  details?: string;
  contractId?: string;
  id?: string;
  delegateUserId?: string;
  reason?: string;
};

export type ScopedStatusTable = "evidence_submissions" | "contract_approvals" | "exceptions";
export type ScopedStatusResult = { ok: true; status: string } | { ok: false; response: Response };

type SupabaseAdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type IntegrationCallbackActionInput = {
  admin: SupabaseAdminClient;
  organizationId: string;
  body: IntegrationCallbackBody;
  validationError: (error: string, diagnosticId: string) => Response;
  persistenceError: (error: string, diagnosticId: string) => Response;
  notFound: () => Response;
  terminalStateConflict: (kind: string, status: string) => Response;
  requireContractInOrganization: (contractId: string) => Promise<Response | null>;
  requireDelegateUserInOrganization: (delegateUserId: string) => Promise<Response | null>;
  loadScopedStatus: (table: ScopedStatusTable, id: string, diagnosticId: string) => Promise<ScopedStatusResult>;
};

export const CALLBACK_ACTIONS = new Set<IntegrationCallbackAction>([
  "create_task",
  "create_exception",
  "ack_complete",
  "approve_evidence",
  "reject_evidence",
  "delegate_approval",
  "resolve_exception",
]);

const EVIDENCE_TERMINAL_STATUSES = new Set(["approved", "rejected"]);
const APPROVAL_TERMINAL_STATUSES = new Set(["approved", "rejected"]);
const EXCEPTION_TERMINAL_STATUSES = new Set(["resolved", "closed"]);

export async function handleIntegrationCallbackAction(input: IntegrationCallbackActionInput): Promise<Response | null> {
  const {
    admin,
    organizationId,
    body,
    validationError,
    persistenceError,
    notFound,
    terminalStateConflict,
    requireContractInOrganization,
    requireDelegateUserInOrganization,
    loadScopedStatus,
  } = input;

  if (body.action === "create_task") {
    const contractId = String(body.contractId ?? "").trim();
    if (contractId && !isUuid(contractId)) {
      return validationError("contractId must be a valid UUID", "integration_callback_contract_id_invalid");
    }
    if (contractId) {
      const contractBlocked = await requireContractInOrganization(contractId);
      if (contractBlocked) return contractBlocked;
    }
    const { data, error } = await admin
      .from("contract_tasks")
      .insert({
        organization_id: organizationId,
        contract_id: contractId || null,
        created_by: null,
        assignee_id: null,
        title: body.title?.trim() || "Inbound action task",
        details: body.details?.trim() || null,
        status: "open",
        priority: "medium",
        created_via: "integration",
      })
      .select("id")
      .single();
    if (error) return persistenceError("Unable to create task", "integration_callback_task_create_failed");
    return jsonOk({ ok: true, taskId: data.id });
  }

  if (body.action === "create_exception") {
    const contractId = String(body.contractId ?? "").trim();
    if (contractId && !isUuid(contractId)) {
      return validationError("contractId must be a valid UUID", "integration_callback_contract_id_invalid");
    }
    if (contractId) {
      const contractBlocked = await requireContractInOrganization(contractId);
      if (contractBlocked) return contractBlocked;
    }
    const { data, error } = await admin
      .from("exceptions")
      .insert({
        organization_id: organizationId,
        contract_id: contractId || null,
        title: body.title?.trim() || "Inbound action exception",
        details: body.details?.trim() || null,
        exception_type: "inbound_action",
        severity: "medium",
        status: "open",
      })
      .select("id")
      .single();
    if (error) return persistenceError("Unable to create exception", "integration_callback_exception_create_failed");
    return jsonOk({ ok: true, exceptionId: data.id });
  }

  if (body.action === "ack_complete") {
    const contractId = String(body.contractId ?? "").trim();
    if (!contractId) return validationError("contractId is required", "integration_callback_contract_id_required");
    if (!isUuid(contractId)) {
      return validationError("contractId must be a valid UUID", "integration_callback_contract_id_invalid");
    }
    const contractBlocked = await requireContractInOrganization(contractId);
    if (contractBlocked) return contractBlocked;
    await admin.from("operational_casefile_events").insert({
      organization_id: organizationId,
      contract_id: contractId,
      event_type: "integration.action_acknowledged",
      details_json: { title: body.title ?? null, details: body.details ?? null },
      source: "integration",
    });
    return jsonOk({ ok: true });
  }

  if (body.action === "approve_evidence") {
    const submissionId = String(body.id ?? "").trim();
    if (!submissionId) return validationError("id is required", "integration_callback_id_required");
    if (!isUuid(submissionId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
    const current = await loadScopedStatus(
      "evidence_submissions",
      submissionId,
      "integration_callback_evidence_approve_lookup_failed"
    );
    if (!current.ok) return current.response;
    if (current.status === "approved") return jsonOk({ ok: true, submissionId });
    if (EVIDENCE_TERMINAL_STATUSES.has(current.status)) {
      return terminalStateConflict("evidence_submission", current.status);
    }
    const { data: submission, error } = await admin
      .from("evidence_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", submissionId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) return persistenceError("Unable to approve evidence", "integration_callback_evidence_approve_failed");
    if (!submission) return notFound();
    return jsonOk({ ok: true, submissionId });
  }

  if (body.action === "reject_evidence") {
    const submissionId = String(body.id ?? "").trim();
    if (!submissionId) return validationError("id is required", "integration_callback_id_required");
    if (!isUuid(submissionId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
    const current = await loadScopedStatus(
      "evidence_submissions",
      submissionId,
      "integration_callback_evidence_reject_lookup_failed"
    );
    if (!current.ok) return current.response;
    if (current.status === "rejected") return jsonOk({ ok: true, submissionId });
    if (EVIDENCE_TERMINAL_STATUSES.has(current.status)) {
      return terminalStateConflict("evidence_submission", current.status);
    }
    const { data: submission, error } = await admin
      .from("evidence_submissions")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejection_reason: String(body.reason ?? "").trim() || "Rejected via integration callback",
      })
      .eq("id", submissionId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) return persistenceError("Unable to reject evidence", "integration_callback_evidence_reject_failed");
    if (!submission) return notFound();
    return jsonOk({ ok: true, submissionId });
  }

  if (body.action === "delegate_approval") {
    const approvalId = String(body.id ?? "").trim();
    const delegateUserId = String(body.delegateUserId ?? "").trim();
    if (!approvalId || !delegateUserId) {
      return validationError("id and delegateUserId are required", "integration_callback_delegate_fields_required");
    }
    if (!isUuid(approvalId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
    if (!isUuid(delegateUserId)) {
      return validationError("delegateUserId must be a valid UUID", "integration_callback_delegate_user_id_invalid");
    }
    const current = await loadScopedStatus(
      "contract_approvals",
      approvalId,
      "integration_callback_approval_delegate_lookup_failed"
    );
    if (!current.ok) return current.response;
    if (APPROVAL_TERMINAL_STATUSES.has(current.status)) {
      return terminalStateConflict("contract_approval", current.status);
    }
    const delegateBlocked = await requireDelegateUserInOrganization(delegateUserId);
    if (delegateBlocked) return delegateBlocked;
    const { data: approval, error } = await admin
      .from("contract_approvals")
      .update({
        approver_id: delegateUserId,
        escalation_status: "none",
        escalation_at: null,
      })
      .eq("id", approvalId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) return persistenceError("Unable to delegate approval", "integration_callback_approval_delegate_failed");
    if (!approval) return notFound();
    return jsonOk({ ok: true, approvalId, delegateUserId });
  }

  if (body.action === "resolve_exception") {
    const exceptionId = String(body.id ?? "").trim();
    if (!exceptionId) return validationError("id is required", "integration_callback_id_required");
    if (!isUuid(exceptionId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
    const current = await loadScopedStatus(
      "exceptions",
      exceptionId,
      "integration_callback_exception_resolve_lookup_failed"
    );
    if (!current.ok) return current.response;
    if (current.status === "resolved") return jsonOk({ ok: true, exceptionId });
    if (EXCEPTION_TERMINAL_STATUSES.has(current.status)) {
      return terminalStateConflict("exception", current.status);
    }
    const { data: exception, error } = await admin
      .from("exceptions")
      .update({
        status: "resolved",
        resolution_action: "fixed",
        resolution_note: String(body.reason ?? "").trim() || "Resolved via integration callback",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", exceptionId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) return persistenceError("Unable to resolve exception", "integration_callback_exception_resolve_failed");
    if (!exception) return notFound();
    return jsonOk({ ok: true, exceptionId });
  }

  return null;
}
