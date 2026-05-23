import { NextResponse } from "next/server";
import { jsonForbidden, jsonNotFound, jsonProblem, jsonRateLimited } from "@/lib/http/problem";
import { parseJsonBodyWithLimit } from "@/lib/security/read-json-body-limited";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  externalActionTokenHash,
  externalActionTokenMatches,
  externalActionTokenPrefix,
  externalActionTokenStableKey,
  isExternalActionTokenSyntax,
  nowIso,
  readJsonBody,
  toSafeString,
  verifyExternalPasscode,
} from "@/lib/v5/api";
import { appendExternalWorkflowStep } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

const ROUTE = "/api/external-actions/[token]/participant/workflow-step";
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

/**
 * Token-authenticated workflow step append for external participants (V6 external collaboration).
 * Internal staff should continue to use POST /api/external-actions/[token]/workflow-step with session auth.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  if (!isFeatureEnabled("v6AssuranceCore")) {
    return jsonForbidden(ROUTE);
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-participant-workflow:${ip}`, RATE_LIMITS.externalTokenMutate);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const { token } = await params;

  const routeParamRejection = rejectUnsafeRouteParams({ token }, ["token"], "/api/external-actions/[token]/participant/workflow-step");

  if (routeParamRejection) return routeParamRejection;
  const tokenHash = externalActionTokenHash(token);
  const tokenKey = externalActionTokenStableKey(token);
  if (!isExternalActionTokenSyntax(token)) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "malformed" });
    return jsonNotFound(ROUTE);
  }
  const tokenRl = await rateLimitCheck(
    `external-participant-workflow:token-hash:${tokenKey}`,
    RATE_LIMITS.externalTokenMutate
  );
  if (!tokenRl.ok) {
    return jsonRateLimited(tokenRl.retryAfterMs, ROUTE);
  }
  const duplicate = await enforceIdempotency(request, {
    scope: "external-workflow.participant-step",
    actorKey: tokenKey,
  });
  if (duplicate) return duplicate;
  const admin = await createAdminClient();
  const tokenPrefix = externalActionTokenPrefix(token);
  const query = admin
    .from("external_action_links")
    .select("id, organization_id, status, expires_at, revoked_at, passcode_hash, scope_json, token_hash");
  const hasHashLookup = typeof (query as { or?: unknown }).or === "function";
  const lookupResult =
    hasHashLookup
      ? await query.or(`token_prefix.eq.${tokenPrefix},token_hash.eq.${tokenHash}`).limit(10)
      : await (query as unknown as TokenHashLookup)
          .eq("token_hash", tokenHash)
          .maybeSingle();
  const candidates = Array.isArray(lookupResult.data) ? lookupResult.data : lookupResult.data ? [lookupResult.data] : [];
  const linkError = lookupResult.error as { message?: string } | null;

  if (linkError) {
    return routeFailure({
      status: 500,
      error: "Failed to load external action",
      code: "data_source_failed",
      diagnosticId: "external_action_participant_link_load_failed",
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
      diagnostic_id: "external_action_participant_revoked",
      route: ROUTE,
    });
  }
  if (link.status !== "open") {
    return jsonProblem(409, {
      error: "Link is not open",
      code: "external_action_not_open",
      diagnostic_id: "external_action_not_open",
      route: ROUTE,
    });
  }
  if (link.expires_at && link.expires_at < nowIso()) {
    return jsonProblem(410, {
      error: "External action link expired",
      code: "external_action_expired",
      diagnostic_id: "external_action_participant_expired",
      route: ROUTE,
    });
  }

  const parsedBody = await parseJsonBodyWithLimit(request, (raw) =>
    readJsonBody<{
      stepType?: string;
      payload?: Record<string, unknown>;
      passcode?: string;
    }>(raw ?? {}, {})
  );
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  if (!verifyExternalPasscode(body.passcode, link.passcode_hash ?? null)) {
    return jsonForbidden(ROUTE);
  }

  void recordApiMutationAuditEvent(admin, {
    organizationId: String(link.organization_id),
    actorUserId: null,
    actorType: "external",
    route: "/api/external-actions/[token]/participant/workflow-step",
    method: "POST",
  }).catch(() => undefined);

  const stepType = toSafeString(body.stepType) || "participant_step";
  const result = await appendExternalWorkflowStep(
    admin,
    String(link.organization_id),
    String(link.id),
    stepType,
    body.payload ?? {},
    undefined
  );

  if (result.error?.message === "workflow_deadline_passed") {
    return routeFailure({
      status: 409,
      error: "External workflow deadline has passed",
      code: "workflow_deadline_passed",
      diagnosticId: "external_action_participant_workflow_deadline_passed",
      phase: "preflight",
    });
  }
  if (result.error?.message === "external_action_event_insert_failed") {
    return NextResponse.json(
      {
        ok: false,
        partial: true,
        errors_count: 1,
        errors: [
          {
            diagnostic_id: "external_action_participant_workflow_event_insert_failed",
            phase: "persist",
            message: "Failed to persist participant workflow event",
          },
        ],
        externalAction: result.data,
      },
      { status: 207, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  if (result.error) {
    return routeFailure({
      status: 500,
      error: "Failed to persist external workflow step",
      code: "persistence_failed",
      diagnosticId: "external_action_participant_workflow_step_persist_failed",
      phase: "persist",
    });
  }

  await incrementV6QualityCounter(
    admin,
    String(link.organization_id),
    "external_workflow_step_appends_total",
    1
  ).catch(() => undefined);

  return NextResponse.json({ externalAction: result.data }, { status: 201, headers: PRIVATE_NO_STORE_HEADERS });
}
