import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { canManageCapability, getApiAuthContext } from "@/lib/v4/api-auth";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import {
  externalActionTokenHash,
  externalActionTokenMatches,
  externalActionTokenPrefix,
  externalActionTokenStableKey,
  isExternalActionTokenSyntax,
  readJsonBody,
  toSafeString,
} from "@/lib/v5/api";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { appendExternalWorkflowStep, setExternalWorkflowAckDeadline } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

const ROUTE = "/api/external-actions/[token]/workflow-step";
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

type TokenHashLookup = {
  eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
};

function routeFailure(input: {
  status: number;
  error: string;
  code: string;
  diagnosticId: string;
  phase: string;
}) {
  return jsonProblem(input.status, {
    error: input.error,
    code: input.code,
    diagnostic_id: input.diagnosticId,
    route: ROUTE,
    details: { phase: input.phase },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-workflow-internal:${ip}`, RATE_LIMITS.externalWorkflowStepInternal);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const ctx = await getApiAuthContext();
  if (!ctx) return jsonUnauthorized(ROUTE);
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/external-actions/[token]/workflow-step",
  });
  if (modeGate) return modeGate;
  if (!(await canManageCapability(ctx, "contracts_edit"))) {
    return jsonForbidden(ROUTE);
  }

  const token = toSafeString((await params).token);

  const routeParamRejection = rejectUnsafeRouteParams({ token }, ["token"], "/api/external-actions/[token]/workflow-step");

  if (routeParamRejection) return routeParamRejection;
  const tokenHash = externalActionTokenHash(token);
  const tokenKey = externalActionTokenStableKey(token);
  if (!isExternalActionTokenSyntax(token)) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "malformed" });
    return jsonNotFound(ROUTE);
  }
  const duplicate = await enforceIdempotency(request, {
    scope: "external-workflow.internal-step",
    actorKey: `${ctx.orgId}:${ctx.userId}:${tokenKey}`,
  });
  if (duplicate) return duplicate;
  void recordApiMutationAuditEvent(ctx.admin, {
    organizationId: ctx.orgId,
    actorUserId: ctx.userId,
    route: "/api/external-actions/[token]/workflow-step",
    method: "POST",
  }).catch(() => undefined);
  const tokenPrefix = externalActionTokenPrefix(token);
  const query = ctx.admin
    .from("external_action_links")
    .select("id, organization_id, status, expires_at, revoked_at, token_hash")
    .eq("organization_id", ctx.orgId);
  const hasHashLookup = typeof (query as { or?: unknown }).or === "function";
  const lookupResult =
    hasHashLookup
      ? await query.or(`token_prefix.eq.${tokenPrefix},token_hash.eq.${tokenHash}`).limit(10)
      : await (query as unknown as TokenHashLookup)
          .eq("token_hash", tokenHash)
          .maybeSingle();
  const candidates = Array.isArray(lookupResult.data) ? lookupResult.data : lookupResult.data ? [lookupResult.data] : [];
  const error = lookupResult.error;

  if (error) {
    return routeFailure({
      status: 500,
      error: "Failed to load external action",
      code: "data_source_failed",
      diagnosticId: "external_action_workflow_link_load_failed",
      phase: "source_query",
    });
  }
  const link = hasHashLookup ? (candidates ?? []).find((row) => externalActionTokenMatches(row, token)) : candidates[0];
  if (!link) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "not_found" });
    return jsonNotFound(ROUTE);
  }
  if (link.status === "revoked" || link.revoked_at) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "revoked" });
    return jsonProblem(410, {
      error: "External action link revoked",
      code: "external_action_revoked",
      diagnostic_id: "external_action_workflow_revoked",
      route: ROUTE,
    });
  }
  if (link.expires_at && link.expires_at < new Date().toISOString()) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "expired" });
    return jsonProblem(410, {
      error: "External action link expired",
      code: "external_action_expired",
      diagnostic_id: "external_action_workflow_expired",
      route: ROUTE,
    });
  }

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{
      stepType?: string;
      payload?: Record<string, unknown>;
      ackDeadlineIso?: string;
    }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  const stepType = toSafeString(body.stepType) || "handoff";

  const result = await appendExternalWorkflowStep(
    ctx.admin,
    ctx.orgId,
    String(link.id),
    stepType,
    body.payload ?? {},
    ctx.userId
  );

  const errors: Array<Record<string, unknown>> = [];
  if (result.error?.message === "workflow_deadline_passed") {
    return routeFailure({
      status: 409,
      error: "External workflow deadline has passed",
      code: "workflow_deadline_passed",
      diagnosticId: "external_action_workflow_deadline_passed",
      phase: "preflight",
    });
  }
  if (result.error?.message === "external_action_event_insert_failed") {
    errors.push({
      diagnostic_id: "external_action_workflow_event_insert_failed",
      phase: "persist",
      message: "Failed to persist external workflow event",
    });
  } else if (result.error) {
    return routeFailure({
      status: 500,
      error: "Failed to persist external workflow step",
      code: "persistence_failed",
      diagnosticId: "external_action_workflow_step_persist_failed",
      phase: "persist",
    });
  }

  if (isFeatureEnabled("v6AssuranceCore")) {
    await incrementV6QualityCounter(ctx.admin, ctx.orgId, "external_workflow_step_appends_total", 1).catch(
      () => undefined
    );
  }

  const ack = toSafeString(body.ackDeadlineIso);
  if (ack) {
    const ackResult = await setExternalWorkflowAckDeadline(ctx.admin, ctx.orgId, String(link.id), ack);
    if (ackResult.error) {
      errors.push({
        diagnostic_id: "external_action_workflow_ack_deadline_persist_failed",
        phase: "persist",
        message: "Failed to persist external workflow acknowledgement deadline",
      });
    }
  }

  return NextResponse.json(
    {
      ...(errors.length > 0 ? { ok: false, partial: true, errors_count: errors.length, errors } : {}),
      externalAction: result.data,
    },
    { status: errors.length > 0 ? 207 : 201, headers: PRIVATE_NO_STORE_HEADERS }
  );
}
