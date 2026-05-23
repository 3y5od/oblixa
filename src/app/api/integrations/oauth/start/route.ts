import { NextResponse } from "next/server";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { createHash, randomBytes } from "crypto";
import { getRequestOrigin } from "@/lib/app-url";
import { readOAuthProviderConfigFromEnv, readOAuthProviderConfigFromConnection } from "@/lib/integrations/oauth-config";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { hasSensitiveActionProof } from "@/lib/security/sensitive-action-proof";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";

const ROUTE = "/api/integrations/oauth/start";

export const maxDuration = 60;

const ALLOWED_PROVIDERS = new Set([
  "google_calendar",
  "outlook_calendar",
  "slack",
  "email",
  "crm",
]);
type OAuthProvider =
  | "google_calendar"
  | "outlook_calendar"
  | "slack"
  | "email"
  | "crm";

function requiredOAuthEnv(provider: OAuthProvider) {
  const stem = provider.toUpperCase();
  return [
    `OAUTH_${stem}_AUTHORIZE_URL`,
    `OAUTH_${stem}_TOKEN_URL`,
    `OAUTH_${stem}_CLIENT_ID`,
    `OAUTH_${stem}_CLIENT_SECRET`,
  ];
}

function oauthFailure(input: {
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
    details: {
      phase: input.phase,
      ...(input.details ?? {}),
    },
  });
}

function isAllowedOAuthCallbackRedirect(request: Request, redirect: URL): boolean {
  const requestOrigin = getRequestOrigin(request);
  return (
    redirect.origin === requestOrigin &&
    redirect.pathname === "/api/integrations/oauth/callback" &&
    redirect.search === "" &&
    redirect.hash === ""
  );
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`oauth-start:${ip}`, { max: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonUnauthorized(ROUTE);

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership || membership.role !== "admin") {
    return jsonProblem(403, {
      error: "Only admins can start integration auth",
      code: "admin_required",
      diagnostic_id: "oauth_start_admin_required",
      route: ROUTE,
    });
  }
  if (!(await hasSensitiveActionProof(supabase, user.id))) {
    void recordSecurityAuditEvent(admin, {
      organizationId: membership.organization_id,
      actorUserId: user.id,
      action: "security.integration_oauth_start_blocked",
      targetType: "integration_oauth",
      targetId: membership.organization_id,
      outcome: "forbidden",
      safeMetadata: { reason: "sensitive_action_proof_required" },
    }).catch(() => undefined);
    return jsonProblem(403, {
      error: "Step-up required",
      code: "step_up_required",
      diagnostic_id: "oauth_start_step_up_required",
      route: ROUTE,
      details: { needStepUp: true },
    });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId: membership.organization_id,
    role: membership.role,
    apiPath: "/api/integrations/oauth/start",
  });
  if (modeGate) return modeGate;
  const duplicate = await enforceIdempotency(request, {
    scope: "integrations.oauth.start",
    actorKey: `${membership.organization_id}:${user.id}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(admin, {
    organizationId: membership.organization_id,
    actorUserId: user.id,
    route: "/api/integrations/oauth/start",
    method: "POST",
  }).catch(() => undefined);

  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    provider?: string;
    redirectUri?: string;
  };
  const provider = String(body.provider ?? "").trim();
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return jsonProblem(400, {
      error: "Unsupported provider",
      code: "unsupported_provider",
      diagnostic_id: "oauth_start_provider_unsupported",
      route: ROUTE,
    });
  }
  const providerId = provider as OAuthProvider;
  const providerConfigFromEnv = readOAuthProviderConfigFromEnv(providerId);
  const { data: existingConnection, error: existingConnectionError } = await admin
    .from("integration_connections")
    .select("config_json")
    .eq("organization_id", membership.organization_id)
    .eq("provider", providerId)
    .maybeSingle();
  if (existingConnectionError) {
    return oauthFailure({
      status: 500,
      error: "Failed to load integration configuration",
      code: "data_source_failed",
      diagnosticId: "oauth_start_connection_load_failed",
      phase: "source_query",
      details: { provider: providerId },
    });
  }
  const providerConfig =
    providerConfigFromEnv ??
    (existingConnection
      ? readOAuthProviderConfigFromConnection({
          config_json: (existingConnection.config_json ?? {}) as Record<
            string,
            unknown
          >,
        })
      : null);
  if (!providerConfig) {
    return oauthFailure({
      status: 503,
      error: "OAuth provider is not configured",
      code: "dependency_blocked",
      diagnosticId: "oauth_start_provider_missing",
      phase: "dependency_preflight",
      details: {
        dependency: "oauth_provider",
        provider: providerId,
        required_env: requiredOAuthEnv(providerId),
      },
    });
  }
  const authorize = validateOutboundHttpUrl(providerConfig.authorizeUrl);
  if (!authorize) {
    return oauthFailure({
      status: 400,
      error: "OAuth authorize URL is invalid or unsafe",
      code: "validation_failed",
      diagnosticId: "oauth_start_authorize_url_invalid",
      phase: "preflight",
      details: { provider: providerId },
    });
  }
  const requestOrigin = getRequestOrigin(request);
  const redirectCandidate =
    String(body.redirectUri ?? "").trim() ||
    `${requestOrigin}/api/integrations/oauth/callback`;
  let redirect: URL;
  try {
    redirect = new URL(redirectCandidate);
  } catch {
    return jsonProblem(400, {
      error: "Invalid redirectUri",
      code: "invalid_redirect_uri",
      diagnostic_id: "oauth_start_redirect_uri_invalid",
      route: ROUTE,
    });
  }
  if (redirect.origin !== requestOrigin) {
    return jsonProblem(400, {
      error: "redirectUri must match request origin",
      code: "redirect_origin_mismatch",
      diagnostic_id: "oauth_start_redirect_origin_mismatch",
      route: ROUTE,
    });
  }
  if (!isAllowedOAuthCallbackRedirect(request, redirect)) {
    return jsonProblem(400, {
      error: "redirectUri must match OAuth callback route",
      code: "redirect_path_mismatch",
      diagnostic_id: "oauth_start_redirect_path_mismatch",
      route: ROUTE,
    });
  }
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const state = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error: insertError } = await admin.from("integration_oauth_states").insert({
    organization_id: membership.organization_id,
    provider,
    state,
    requested_by: user.id,
    expires_at: expiresAt,
    redirect_uri: redirect.toString(),
    code_verifier: verifier,
    code_challenge_method: "S256",
  });
  if (insertError) {
    return oauthFailure({
      status: 500,
      error: "Failed to create oauth state",
      code: "persistence_failed",
      diagnosticId: "oauth_start_state_create_failed",
      phase: "persist",
      details: { provider: providerId },
    });
  }
  const url = new URL(authorize.toString());
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirect.toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", providerConfig.clientId);
  if (providerConfig.scope) url.searchParams.set("scope", providerConfig.scope);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.json({ ok: true, provider, state, authorizeUrl: url.toString(), expiresAt });
}
