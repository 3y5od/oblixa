import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { parseFutureIsoTimestamp } from "@/lib/security/validation";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import {
  externalActionTokenHash,
  externalActionTokenPrefix,
  hashExternalPasscode,
  readJsonBody,
  toSafeString,
} from "@/lib/v5/api";
import {
  type ExternalActionType,
  externalActionTypeValidationError,
  isValidExternalActionType,
} from "@/lib/v5/external-action-types";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";

const ROUTE = "/api/external-actions/create-link";
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

function createToken() {
  return randomBytes(24).toString("hex");
}

const SENSITIVE_EXTERNAL_ACTION_TYPES = new Set<ExternalActionType>([
  "submit_evidence",
  "structured_request_response",
  "confirm_renewal_input",
  "upload_requested_document",
  "amendment_intake_response",
  "complete_attestation",
  "review_decision_packet",
]);

function isSensitiveExternalActionType(actionType: ExternalActionType): boolean {
  return SENSITIVE_EXTERNAL_ACTION_TYPES.has(actionType);
}

function parseExpiresInHours(value: unknown, actionType: ExternalActionType): number {
  const sensitive = isSensitiveExternalActionType(actionType);
  const defaultHours = sensitive ? 24 : 72;
  const maxHours = sensitive ? 168 : 720;
  const parsed = Number(value ?? defaultHours);
  if (!Number.isFinite(parsed)) return defaultHours;
  return Math.max(1, Math.min(maxHours, Math.floor(parsed)));
}

function routeFailure(input: {
  status: number;
  error: string;
  code: string;
  diagnosticId: string;
  phase: string;
  details?: Record<string, unknown>;
}) {
  return jsonProblem(input.status, {
    error: input.error,
    code: input.code,
    diagnostic_id: input.diagnosticId,
    route: ROUTE,
    details: { phase: input.phase, ...(input.details ?? {}) },
  });
}

export async function POST(request: Request) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonForbidden(ROUTE);
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/external-actions/create-link",
  });
  if (modeGate) return modeGate;

  const duplicate = await enforceIdempotency(request, {
    scope: "external-action.create-link",
    actorKey: `${ctx.orgId}:${ctx.userId}`,
  });
  if (duplicate) return duplicate;

  const _limitedBody = await readJsonBodyLimited(request);
  if (!_limitedBody.ok) return _limitedBody.response;
  const raw = _limitedBody.body ?? {};
  const body = readJsonBody<{
    actionType?: string;
    expiresInHours?: number;
    scope?: Record<string, unknown>;
    requiresReauth?: boolean;
    passcode?: string;
    workflowConfig?: Record<string, unknown>;
    /** ISO timestamp for external multi-step acknowledgement deadline (stored on link scope). */
    workflowDeadlineIso?: string;
  }>(raw, {});
  const rawAction = toSafeString(body.actionType) || "submit_evidence";
  if (!isValidExternalActionType(rawAction)) {
    return jsonProblem(400, {
      error: externalActionTypeValidationError(),
      code: "invalid_external_action_type",
      diagnostic_id: "external_action_type_invalid",
      route: ROUTE,
    });
  }
  const actionType = rawAction;
  const expiresInHours = parseExpiresInHours(body.expiresInHours, actionType);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const token = createToken();
  const tokenHash = externalActionTokenHash(token);
  const tokenPrefix = externalActionTokenPrefix(token);
  const scope: Record<string, unknown> = {
    ...(body.scope ?? {}),
    workflow_config: body.workflowConfig ?? {},
    collaboration_version: "v6",
  };
  const workflowDeadlineRaw = toSafeString(body.workflowDeadlineIso);
  if (workflowDeadlineRaw) {
    const parsedDeadline = parseFutureIsoTimestamp(workflowDeadlineRaw, { maxFutureDays: 30 });
    if (!parsedDeadline.ok) {
      return jsonProblem(400, {
        error: "workflowDeadlineIso must be a future ISO timestamp",
        code: "invalid_workflow_deadline",
        diagnostic_id: "external_action_workflow_deadline_invalid",
        route: ROUTE,
      });
    }
    const deadlineMs = parsedDeadline.date?.getTime() ?? Number.NaN;
    const expMs = Date.parse(expiresAt);
    if (Number.isFinite(expMs) && deadlineMs > expMs) {
      return jsonProblem(400, {
        error: "workflowDeadlineIso must be on or before the link expires_at",
        code: "invalid_workflow_deadline",
        diagnostic_id: "external_action_workflow_deadline_after_expiry",
        route: ROUTE,
      });
    }
    scope.workflow_deadline_iso = parsedDeadline.value;
    scope.workflow_ack_required = true;
  }
  const rawDw = scope["decisionWorkspaceId"];
  const decisionWorkspaceId =
    typeof rawDw === "string" && /^[0-9a-f-]{36}$/i.test(rawDw) ? rawDw : null;

  const passPlain = toSafeString(body.passcode);
  const passcodeHash = passPlain.length > 0 ? hashExternalPasscode(passPlain) : null;
  const requiresReauth = Boolean(body.requiresReauth) || (isSensitiveExternalActionType(actionType) && !passcodeHash);

  const { data, error } = await ctx.admin
    .from("external_action_links")
    .insert({
      organization_id: ctx.orgId,
      token: null,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      action_type: actionType,
      scope_json: scope,
      decision_workspace_id: decisionWorkspaceId,
      passcode_hash: passcodeHash,
      expires_at: expiresAt,
      requires_reauth: requiresReauth,
      created_by: ctx.userId,
    })
    .select("id, action_type, expires_at, status")
    .single();
  if (error) {
    return routeFailure({
      status: 500,
      error: "Failed to create external action link",
      code: "persistence_failed",
      diagnosticId: "external_action_link_create_failed",
      phase: "persist",
    });
  }

  const errors: Array<Record<string, unknown>> = [];
  const { error: eventError } = await ctx.admin.from("external_action_events").insert({
    organization_id: ctx.orgId,
    external_action_link_id: data.id,
    event_type: "external.link_created",
    payload_json: { action_type: data.action_type, expires_at: data.expires_at },
    actor_user_id: ctx.userId,
  });
  if (eventError) {
    errors.push({
      diagnostic_id: "external_action_link_event_insert_failed",
      phase: "persist",
      message: "Failed to persist external action link audit event",
    });
  }

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "external_action_links_created_total", 1).catch(
      () => undefined
    );
  }
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_post_external_create_link_total", 1).catch(
    () => undefined
  );

  return NextResponse.json(
    {
      ...(errors.length > 0 ? { ok: false, partial: true, errors_count: errors.length, errors } : {}),
      externalAction: { ...data, token },
    },
    { status: errors.length > 0 ? 207 : 201, headers: PRIVATE_NO_STORE_HEADERS }
  );
}
