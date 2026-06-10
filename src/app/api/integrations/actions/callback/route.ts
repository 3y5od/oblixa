import {
  jsonConflict,
  jsonMisconfigured,
  jsonNotFound,
  jsonOk,
  jsonProblem,
  jsonRateLimited,
  jsonUnauthorized,
} from "@/lib/http/problem";
import {
  BODY_LIMIT_STRICT_INBOUND,
  readJsonBodyLimited,
  readTextBodyLimited,
} from "@/lib/security/read-json-body-limited";
import { createAdminClient } from "@/lib/supabase/server";
import { inboundOrgNotAllowedResponse } from "@/lib/security/inbound-org-allowlist";
import { isInboundAutomationAuthorized } from "@/lib/security/inbound-automation-token";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/validation";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { enforceIdempotency } from "@/lib/idempotency";
import { verifyInboundCallbackHmac } from "@/lib/security/inbound-callback-signing";
import { isProductionLikeInboundEnvironment } from "@/lib/security/inbound-production-env";

const ROUTE = "/api/integrations/actions/callback";

export const maxDuration = 60;

type IntegrationCallbackAction =
  | "create_task"
  | "create_exception"
  | "ack_complete"
  | "approve_evidence"
  | "reject_evidence"
  | "delegate_approval"
  | "resolve_exception";

type IntegrationCallbackBody = {
  organizationId?: string;
  action?: IntegrationCallbackAction;
  title?: string;
  details?: string;
  contractId?: string;
  id?: string;
  delegateUserId?: string;
  reason?: string;
};

const CALLBACK_ACTIONS = new Set<IntegrationCallbackAction>([
  "create_task",
  "create_exception",
  "ack_complete",
  "approve_evidence",
  "reject_evidence",
  "delegate_approval",
  "resolve_exception",
]);

const CALLBACK_ALLOWED_FIELDS = new Set([
  "organizationId",
  "action",
  "title",
  "details",
  "contractId",
  "id",
  "delegateUserId",
  "reason",
]);

const CALLBACK_TITLE_MAX = 240;
const CALLBACK_DETAILS_MAX = 10_000;
const CALLBACK_REASON_MAX = 2_000;

const EVIDENCE_TERMINAL_STATUSES = new Set(["approved", "rejected"]);
const APPROVAL_TERMINAL_STATUSES = new Set(["approved", "rejected"]);
const EXCEPTION_TERMINAL_STATUSES = new Set(["resolved", "closed"]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalStringField(
  input: Record<string, unknown>,
  key: keyof IntegrationCallbackBody,
  maxLength: number
): { ok: true; value?: string } | { ok: false; response: Response } {
  const value = input[key];
  if (value == null) return { ok: true };
  if (typeof value !== "string") {
    return {
      ok: false,
      response: validationError(`${key} must be a string`, "integration_callback_field_type_invalid"),
    };
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      response: validationError(`${key} is too long`, "integration_callback_field_too_long"),
    };
  }
  return { ok: true, value: trimmed };
}

function normalizeCallbackBody(
  raw: unknown
): { ok: true; body: IntegrationCallbackBody } | { ok: false; response: Response } {
  if (!isRecord(raw)) {
    return {
      ok: false,
      response: validationError("Invalid JSON body", "integration_callback_invalid_json_body"),
    };
  }
  for (const key of Object.keys(raw)) {
    if (!CALLBACK_ALLOWED_FIELDS.has(key)) {
      return {
        ok: false,
        response: validationError("Unsupported field", "integration_callback_unknown_field"),
      };
    }
  }

  const organizationId = optionalStringField(raw, "organizationId", 36);
  if (!organizationId.ok) return organizationId;
  const actionRaw = optionalStringField(raw, "action", 64);
  if (!actionRaw.ok) return actionRaw;
  const title = optionalStringField(raw, "title", CALLBACK_TITLE_MAX);
  if (!title.ok) return title;
  const details = optionalStringField(raw, "details", CALLBACK_DETAILS_MAX);
  if (!details.ok) return details;
  const contractId = optionalStringField(raw, "contractId", 36);
  if (!contractId.ok) return contractId;
  const id = optionalStringField(raw, "id", 36);
  if (!id.ok) return id;
  const delegateUserId = optionalStringField(raw, "delegateUserId", 36);
  if (!delegateUserId.ok) return delegateUserId;
  const reason = optionalStringField(raw, "reason", CALLBACK_REASON_MAX);
  if (!reason.ok) return reason;

  const action = actionRaw.value;
  if (action && !CALLBACK_ACTIONS.has(action as IntegrationCallbackAction)) {
    return {
      ok: false,
      response: validationError("Unsupported action", "integration_callback_unsupported_action"),
    };
  }

  return {
    ok: true,
    body: {
      organizationId: organizationId.value,
      action: action as IntegrationCallbackAction | undefined,
      title: title.value,
      details: details.value,
      contractId: contractId.value,
      id: id.value,
      delegateUserId: delegateUserId.value,
      reason: reason.value,
    },
  };
}

async function readCallbackBody(
  request: Request
): Promise<{ ok: true; body: IntegrationCallbackBody } | { ok: false; response: Response }> {
  const hmacSecret = process.env.INBOUND_INTEGRATIONS_CALLBACK_HMAC_SECRET?.trim();
  const signatureRequired = !!hmacSecret || isProductionLikeInboundEnvironment();
  let rawBody: unknown;

  if (signatureRequired) {
    if (!hmacSecret) {
      return { ok: false, response: jsonMisconfigured("INBOUND_INTEGRATIONS_CALLBACK_HMAC_SECRET", ROUTE) };
    }
    const _lb_raw = await readTextBodyLimited(request, BODY_LIMIT_STRICT_INBOUND);
    if (!_lb_raw.ok) return _lb_raw;
    const mac = verifyInboundCallbackHmac({
      secret: hmacSecret,
      rawBody: _lb_raw.body,
      signatureHeader: request.headers.get("x-oblixa-callback-signature"),
      timestampHeader: request.headers.get("x-oblixa-callback-timestamp"),
    });
    if (!mac.ok) {
      return {
        ok: false,
        response: jsonProblem(401, {
          error: "Invalid integration callback signature",
          code: "invalid_signature",
          diagnostic_id: "integration_callback_signature_invalid",
          route: ROUTE,
        }),
      };
    }
    try {
      rawBody = JSON.parse(_lb_raw.body);
    } catch {
      return {
        ok: false,
        response: validationError("Invalid JSON", "integration_callback_invalid_json"),
      };
    }
  } else {
    const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND);
    if (!_lb_body.ok) return _lb_body;
    rawBody = _lb_body.body;
  }

  return normalizeCallbackBody(rawBody);
}

async function loadScopedStatus(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  table: "evidence_submissions" | "contract_approvals" | "exceptions",
  organizationId: string,
  id: string,
  diagnosticId: string
): Promise<{ ok: true; status: string } | { ok: false; response: Response }> {
  const { data, error } = await admin
    .from(table)
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { ok: false, response: persistenceError("Unable to load callback target", diagnosticId) };
  if (!data) return { ok: false, response: jsonNotFound(ROUTE) };
  const status = typeof data.status === "string" ? data.status : "";
  return { ok: true, status };
}

async function requireDelegateUserInOrganization(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  organizationId: string,
  delegateUserId: string
): Promise<Response | null> {
  const { data, error } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", delegateUserId)
    .maybeSingle();
  if (error) return persistenceError("Unable to verify delegate user", "integration_callback_delegate_user_lookup_failed");
  if (!data) {
    return validationError(
      "delegateUserId must belong to the organization",
      "integration_callback_delegate_user_not_member"
    );
  }
  return null;
}

function terminalStateConflict(kind: string, status: string) {
  return jsonConflict(ROUTE, { reason: "terminal_state", resource: kind, status });
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
  if (error) return persistenceError("Unable to verify contract", "integration_callback_contract_lookup_failed");
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

  const _lb_body = await readCallbackBody(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = _lb_body.body;
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
    if (error) return persistenceError("Unable to create task", "integration_callback_task_create_failed");
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
    if (error) return persistenceError("Unable to create exception", "integration_callback_exception_create_failed");
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
    const current = await loadScopedStatus(
      admin,
      "evidence_submissions",
      organizationId,
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
    if (!submission) {
      return jsonNotFound(ROUTE);
    }
    return jsonOk({ ok: true, submissionId });
  }

  if (body.action === "reject_evidence") {
    const submissionId = String(body.id ?? "").trim();
    if (!submissionId) return validationError("id is required", "integration_callback_id_required");
    if (!isUuid(submissionId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
    const current = await loadScopedStatus(
      admin,
      "evidence_submissions",
      organizationId,
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
    const current = await loadScopedStatus(
      admin,
      "contract_approvals",
      organizationId,
      approvalId,
      "integration_callback_approval_delegate_lookup_failed"
    );
    if (!current.ok) return current.response;
    if (APPROVAL_TERMINAL_STATUSES.has(current.status)) {
      return terminalStateConflict("contract_approval", current.status);
    }
    const delegateBlocked = await requireDelegateUserInOrganization(admin, organizationId, delegateUserId);
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
    if (!approval) {
      return jsonNotFound(ROUTE);
    }
    return jsonOk({ ok: true, approvalId, delegateUserId });
  }

  if (body.action === "resolve_exception") {
    const exceptionId = String(body.id ?? "").trim();
    if (!exceptionId) return validationError("id is required", "integration_callback_id_required");
    if (!isUuid(exceptionId)) return validationError("id must be a valid UUID", "integration_callback_id_invalid");
    const current = await loadScopedStatus(
      admin,
      "exceptions",
      organizationId,
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
    if (!exception) {
      return jsonNotFound(ROUTE);
    }
    return jsonOk({ ok: true, exceptionId });
  }

  return validationError("Unsupported action", "integration_callback_unsupported_action");
}
