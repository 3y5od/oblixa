import { jsonNotFound, jsonOk, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { BODY_LIMIT_STRICT_INBOUND, readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { createAdminClient } from "@/lib/supabase/server";
import { inboundOrgNotAllowedResponse } from "@/lib/security/inbound-org-allowlist";
import { isInboundAutomationAuthorized } from "@/lib/security/inbound-automation-token";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/validation";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { enforceIdempotency } from "@/lib/idempotency";

const ROUTE = "/api/integrations/actions/callback";

export const maxDuration = 60;

function validationError(error: string, diagnosticId: string) {
  return jsonProblem(400, {
    error,
    code: "validation_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
  });
}

function persistenceError(error: string, diagnosticId: string) {
  return jsonProblem(400, {
    error,
    code: "persistence_failed",
    diagnostic_id: diagnosticId,
    route: ROUTE,
  });
}

async function requireContractInOrganization(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  organizationId: string,
  contractId: string
) {
  const { data, error } = await admin
    .from("contracts")
    .select("id")
    .eq("id", contractId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return persistenceError(error.message, "integration_callback_contract_lookup_failed");
  if (!data) return validationError("Contract not found in organization", "integration_callback_contract_not_found");
  return null;
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rate = await rateLimitCheck(
    `inbound:integrations-actions:${ip}`,
    RATE_LIMITS.integrationsActionsInbound
  );
  if (!rate.ok) {
    return jsonRateLimited(rate.retryAfterMs, ROUTE);
  }

  if (!isInboundAutomationAuthorized(request, "integrations_callback")) {
    return jsonUnauthorized(ROUTE);
  }

  const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    organizationId?: string;
    action?:
      | "create_task"
      | "create_exception"
      | "ack_complete"
      | "approve_evidence"
      | "reject_evidence"
      | "delegate_approval"
      | "resolve_exception";
    title?: string;
    details?: string;
    contractId?: string;
    id?: string;
    delegateUserId?: string;
    reason?: string;
  };
  const organizationId = String(body.organizationId ?? "").trim();
  if (!organizationId) return validationError("organizationId is required", "integration_callback_org_required");
  if (!isUuid(organizationId)) {
    return validationError("organizationId must be a valid UUID", "integration_callback_org_id_invalid");
  }

  const orgActionRate = await rateLimitCheck(
    `inbound:integrations-actions:org:${organizationId}:${String(body.action ?? "unknown")}`,
    RATE_LIMITS.integrationsActionsInbound
  );
  if (!orgActionRate.ok) {
    return jsonRateLimited(orgActionRate.retryAfterMs, ROUTE);
  }

  const blocked = inboundOrgNotAllowedResponse(organizationId);
  if (blocked) return blocked;

  const admin = await createAdminClient();
  const duplicate = await enforceIdempotency(request, {
    scope: "integrations.actions.callback",
    actorKey: `${organizationId}:${String(body.action ?? "unknown")}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(admin, {
    organizationId,
    actorUserId: null,
    actorType: "external",
    route: ROUTE,
    method: "POST",
  }).catch(() => undefined);

  if (body.action === "create_task") {
    const contractId = String(body.contractId ?? "").trim();
    if (contractId && !isUuid(contractId)) {
      return validationError("contractId must be a valid UUID", "integration_callback_contract_id_invalid");
    }
    if (contractId) {
      const contractBlocked = await requireContractInOrganization(admin, organizationId, contractId);
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
    if (error) return persistenceError(error.message, "integration_callback_task_create_failed");
    return jsonOk({ ok: true, taskId: data.id });
  }

  if (body.action === "create_exception") {
    const contractId = String(body.contractId ?? "").trim();
    if (contractId && !isUuid(contractId)) {
      return validationError("contractId must be a valid UUID", "integration_callback_contract_id_invalid");
    }
    if (contractId) {
      const contractBlocked = await requireContractInOrganization(admin, organizationId, contractId);
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
    if (error) return persistenceError(error.message, "integration_callback_exception_create_failed");
    return jsonOk({ ok: true, exceptionId: data.id });
  }

  if (body.action === "ack_complete") {
    const contractId = String(body.contractId ?? "").trim();
    if (!contractId) return validationError("contractId is required", "integration_callback_contract_id_required");
    if (!isUuid(contractId)) {
      return validationError("contractId must be a valid UUID", "integration_callback_contract_id_invalid");
    }
    const contractBlocked = await requireContractInOrganization(admin, organizationId, contractId);
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
    const { data: submission, error } = await admin
      .from("evidence_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", submissionId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (error) return persistenceError(error.message, "integration_callback_evidence_approve_failed");
    if (!submission) {
      return jsonNotFound(ROUTE);
    }
    return jsonOk({ ok: true, submissionId });
  }

  if (body.action === "reject_evidence") {
    const submissionId = String(body.id ?? "").trim();
    if (!submissionId) return validationError("id is required", "integration_callback_id_required");
    if (!isUuid(submissionId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
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
    if (error) return persistenceError(error.message, "integration_callback_evidence_reject_failed");
    if (!submission) {
      return jsonNotFound(ROUTE);
    }
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
    if (error) return persistenceError(error.message, "integration_callback_approval_delegate_failed");
    if (!approval) {
      return jsonNotFound(ROUTE);
    }
    return jsonOk({ ok: true, approvalId, delegateUserId });
  }

  if (body.action === "resolve_exception") {
    const exceptionId = String(body.id ?? "").trim();
    if (!exceptionId) return validationError("id is required", "integration_callback_id_required");
    if (!isUuid(exceptionId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
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
    if (error) return persistenceError(error.message, "integration_callback_exception_resolve_failed");
    if (!exception) {
      return jsonNotFound(ROUTE);
    }
    return jsonOk({ ok: true, exceptionId });
  }

  return validationError("Unsupported action", "integration_callback_unsupported_action");
}
