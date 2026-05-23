import { NextResponse } from "next/server";
import { jsonNotFound, jsonProblem, jsonRateLimited } from "@/lib/http/problem";
import {
  externalActionTokenHash,
  externalActionTokenMatches,
  externalActionTokenPrefix,
  externalActionTokenStableKey,
  isExternalActionTokenSyntax,
  nowIso,
  signExternalSubmitTicket,
} from "@/lib/v5/api";
import { createAdminClient } from "@/lib/supabase/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { recordMissedExternalDeadlineFinding } from "@/lib/v6/external-collaboration";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { rejectUnsafeRouteParams } from "@/lib/security/route-params";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

const ROUTE = "/api/external-actions/[token]/status";
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

type TokenHashLookup = {
  eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
};

function publicRouteFailure(input: {
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

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`external-status:${ip}`, RATE_LIMITS.externalTokenRead);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const { token } = await params;
  const routeParamRejection = rejectUnsafeRouteParams({ token }, ["token"], "/api/external-actions/[token]/status");
  if (routeParamRejection) return routeParamRejection;
  const tokenHash = externalActionTokenHash(token);
  const tokenKey = externalActionTokenStableKey(token);
  if (!isExternalActionTokenSyntax(token)) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "malformed" });
    return jsonNotFound(ROUTE);
  }
  const tokenRl = await rateLimitCheck(`external-status:token-hash:${tokenKey}`, RATE_LIMITS.externalTokenRead);
  if (!tokenRl.ok) {
    return jsonRateLimited(tokenRl.retryAfterMs, ROUTE);
  }
  const admin = await createAdminClient();
  const tokenPrefix = externalActionTokenPrefix(token);
  const query = admin
    .from("external_action_links")
    .select(
      "id, organization_id, action_type, status, expires_at, revoked_at, requires_reauth, submitted_at, passcode_hash, scope_json, token_hash"
    );
  const hasHashLookup = typeof (query as { or?: unknown }).or === "function";
  const result =
    hasHashLookup
      ? await query.or(`token_prefix.eq.${tokenPrefix},token_hash.eq.${tokenHash}`).limit(10)
      : await (query as unknown as TokenHashLookup)
          .eq("token_hash", tokenHash)
          .maybeSingle();
  const candidates = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  const error = result.error;
  if (error) {
    return publicRouteFailure({
      status: 500,
      error: "Failed to load external action",
      code: "data_source_failed",
      diagnosticId: "external_action_status_load_failed",
      phase: "source_query",
    });
  }
  const data = hasHashLookup ? (candidates ?? []).find((row) => externalActionTokenMatches(row, token)) : candidates[0];
  if (!data) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "not_found" });
    return jsonNotFound(ROUTE);
  }
  if (data.status === "revoked" || data.revoked_at) {
    recordPublicTokenMiss({ surface: "external_action", route: ROUTE, tokenKey, ip, reason: "revoked" });
    return jsonProblem(410, {
      error: "External action link revoked",
      code: "external_action_revoked",
      diagnostic_id: "external_action_status_revoked",
      route: ROUTE,
    });
  }

  if (data.organization_id) {
    void recordApiRouteAuditEvent(admin, {
      organizationId: String(data.organization_id),
      actorUserId: null,
      actorType: "external",
      route: ROUTE,
      method: "GET",
      action: "api.sensitive_read_authorized",
    }).catch(() => undefined);
  }

  if (isFeatureEnabled("v6AssuranceCore") && data.organization_id) {
    await incrementV6QualityCounter(
      admin,
      String(data.organization_id),
      "external_public_status_polls_total",
      1
    ).catch(() => undefined);
  }

  const expired = data.expires_at && data.expires_at < nowIso();
  const effectiveStatus = expired && data.status === "open" ? "expired" : data.status;

  if (
    isFeatureEnabled("v6AssuranceCore") &&
    expired &&
    data.status === "open" &&
    data.organization_id
  ) {
    await recordMissedExternalDeadlineFinding(
      admin,
      String(data.organization_id),
      String(data.id),
      String(data.action_type)
    ).catch(() => undefined);
  }
  const {
    id,
    action_type,
    expires_at,
    requires_reauth,
    submitted_at,
    passcode_hash: _h,
  } = data;
  const scope = (data.scope_json as Record<string, unknown> | null) ?? {};
  const submitTicket =
    data.requires_reauth && effectiveStatus === "open" && !expired
      ? signExternalSubmitTicket({ linkId: data.id, urlToken: token })
      : undefined;
  return NextResponse.json(
    {
      externalAction: {
        id,
        action_type,
        expires_at,
        requires_reauth,
        submitted_at,
        requires_passcode: Boolean(_h),
        status: effectiveStatus,
        expired,
        workflow_step_count: Array.isArray(scope.workflow_chain) ? scope.workflow_chain.length : 0,
        workflow_deadline_iso:
          typeof scope.workflow_deadline_iso === "string" ? scope.workflow_deadline_iso : null,
        workflow_ack_required: Boolean(scope.workflow_ack_required),
        correction_message: typeof scope.correction_message === "string" ? scope.correction_message : null,
        submitTicket,
        reauth_instructions:
          data.requires_reauth && effectiveStatus === "open" && !expired
            ? "Call GET status before each submit; include submitTicket from this response in your POST body."
            : undefined,
      },
    },
    { headers: PRIVATE_NO_STORE_HEADERS }
  );
}
