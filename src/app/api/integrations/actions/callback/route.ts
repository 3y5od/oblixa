import { jsonConflict, jsonMisconfigured, jsonNotFound, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
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
import {
  CALLBACK_ACTIONS,
  handleIntegrationCallbackAction,
  type IntegrationCallbackAction,
  type IntegrationCallbackBody,
  type ScopedStatusTable,
  type ScopedStatusResult,
} from "@/lib/integrations/actions-callback-handler";

const ROUTE = "/api/integrations/actions/callback";

export const maxDuration = 60;

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
  table: ScopedStatusTable,
  organizationId: string,
  id: string,
  diagnosticId: string
): Promise<ScopedStatusResult> {
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

function callbackTargetNotFound() {
  return jsonNotFound(ROUTE);
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

  const actionResponse = await handleIntegrationCallbackAction({
    admin,
    organizationId,
    body,
    validationError,
    persistenceError,
    notFound: callbackTargetNotFound,
    terminalStateConflict,
    requireContractInOrganization: (contractId) =>
      requireContractInOrganization(admin, organizationId, contractId),
    requireDelegateUserInOrganization: (delegateUserId) =>
      requireDelegateUserInOrganization(admin, organizationId, delegateUserId),
    loadScopedStatus: (table, id, diagnosticId) =>
      loadScopedStatus(admin, table, organizationId, id, diagnosticId),
  });
  if (actionResponse) return actionResponse;

  return validationError("Unsupported action", "integration_callback_unsupported_action");
}
