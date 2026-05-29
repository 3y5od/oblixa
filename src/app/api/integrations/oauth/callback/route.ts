import { NextResponse } from "next/server";
import { jsonProblem, jsonRateLimited } from "@/lib/http/problem";
import { createAdminClient } from "@/lib/supabase/server";
import { encryptIntegrationToken } from "@/lib/security/token-crypto";
import { readOAuthProviderConfigFromConnection, readOAuthProviderConfigFromEnv } from "@/lib/integrations/oauth-config";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { safeFetch } from "@/lib/security/safe-fetch";
import { getRequestOrigin } from "@/lib/app-url";
import { recordApiRouteAuditEvent } from "@/lib/security/api-mutation-audit";
import { validateBoundedString } from "@/lib/security/validation";

const ROUTE = "/api/integrations/oauth/callback";
const MAX_OAUTH_STATE_LEN = 256;
const MAX_OAUTH_CODE_LEN = 2048;
const MAX_CONNECTED_ACCOUNT_LEN = 256;

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

function isAllowedOAuthCallbackRedirect(request: Request, redirectUri: string): boolean {
  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    return false;
  }
  const requestOrigin = getRequestOrigin(request);
  return (
    redirect.origin === requestOrigin &&
    redirect.pathname === "/api/integrations/oauth/callback" &&
    redirect.search === "" &&
    redirect.hash === ""
  );
}

function validateOAuthCallbackText(
  value: string,
  maxLength: number
): { ok: true; value: string } | { ok: false; reason: "invalid_string" | "string_too_long" | "unsafe_characters" } {
  const validated = validateBoundedString(value, { maxLength });
  if (!validated.ok) return { ok: false, reason: validated.error };
  return validated;
}

async function consumeOAuthStateForTokenExchange(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  stateId: string
): Promise<"ok" | "replay" | "error"> {
  const { data, error } = await admin
    .from("integration_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", stateId)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (error) return "error";
  return data ? "ok" : "replay";
}

export async function GET(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`oauth-callback:${ip}`, {
    max: 40,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const url = new URL(request.url);
  const state = url.searchParams.get("state")?.trim() ?? "";
  const code = url.searchParams.get("code")?.trim() ?? "";
  const providerError = url.searchParams.get("error")?.trim() ?? "";
  const accountRaw = url.searchParams.get("account")?.trim() ?? "";
  if (providerError) {
    return jsonProblem(400, {
      error: "OAuth authorization was denied or failed",
      code: "provider_authorization_failed",
      diagnostic_id: "oauth_callback_provider_error",
      route: ROUTE,
      details: { phase: "provider_callback" },
    });
  }
  if (!state || !code) {
    return jsonProblem(400, {
      error: "Missing state or code",
      code: "missing_state_or_code",
      diagnostic_id: "oauth_callback_missing_state_or_code",
      route: ROUTE,
    });
  }
  if (!validateOAuthCallbackText(state, MAX_OAUTH_STATE_LEN).ok) {
    return jsonProblem(400, {
      error: "Invalid state",
      code: "invalid_state",
      diagnostic_id: "oauth_callback_invalid_state",
      route: ROUTE,
    });
  }
  if (!validateOAuthCallbackText(code, MAX_OAUTH_CODE_LEN).ok) {
    return jsonProblem(400, {
      error: "Invalid code",
      code: "invalid_code",
      diagnostic_id: "oauth_callback_invalid_code",
      route: ROUTE,
    });
  }
  const accountValidation = accountRaw
    ? validateOAuthCallbackText(accountRaw, MAX_CONNECTED_ACCOUNT_LEN)
    : { ok: true as const, value: "" };
  if (!accountValidation.ok) {
    return jsonProblem(400, {
      error: "Invalid connected account",
      code: "invalid_connected_account",
      diagnostic_id: "oauth_callback_connected_account_invalid",
      route: ROUTE,
    });
  }
  const account = accountValidation.value || null;

  const admin = await createAdminClient();
  const { data: authState, error: authStateError } = await admin
    .from("integration_oauth_states")
    .select(
      "id, organization_id, provider, requested_by, consumed_at, expires_at, redirect_uri, code_verifier, code_challenge_method"
    )
    .eq("state", state)
    .maybeSingle();
  if (authStateError) {
    return oauthFailure({
      status: 500,
      error: "Failed to load oauth state",
      code: "data_source_failed",
      diagnosticId: "oauth_callback_state_load_failed",
      phase: "source_query",
    });
  }
  if (!authState) {
    return jsonProblem(400, {
      error: "Invalid state",
      code: "invalid_state",
      diagnostic_id: "oauth_callback_invalid_state",
      route: ROUTE,
    });
  }
  if (authState.consumed_at) {
    return jsonProblem(400, {
      error: "State already used",
      code: "state_already_used",
      diagnostic_id: "oauth_callback_state_used",
      route: ROUTE,
    });
  }
  if (new Date(authState.expires_at).getTime() < Date.now()) {
    return jsonProblem(400, {
      error: "State expired",
      code: "state_expired",
      diagnostic_id: "oauth_callback_state_expired",
      route: ROUTE,
    });
  }
  if (!authState.redirect_uri || !authState.code_verifier) {
    return jsonProblem(400, {
      error: "OAuth state is incomplete",
      code: "oauth_state_incomplete",
      diagnostic_id: "oauth_callback_state_incomplete",
      route: ROUTE,
    });
  }
  if (authState.code_challenge_method !== "S256") {
    return jsonProblem(400, {
      error: "OAuth state is incomplete",
      code: "oauth_state_incomplete",
      diagnostic_id: "oauth_callback_pkce_method_invalid",
      route: ROUTE,
    });
  }
  if (!isAllowedOAuthCallbackRedirect(request, authState.redirect_uri)) {
    return jsonProblem(400, {
      error: "Invalid redirect URI",
      code: "invalid_redirect_uri",
      diagnostic_id: "oauth_callback_redirect_uri_invalid",
      route: ROUTE,
    });
  }
  const rawProvider = String(authState.provider ?? "").trim();
  if (!ALLOWED_PROVIDERS.has(rawProvider)) {
    return jsonProblem(400, {
      error: "Unsupported provider",
      code: "unsupported_provider",
      diagnostic_id: "oauth_callback_provider_unsupported",
      route: ROUTE,
    });
  }
  const provider = rawProvider as OAuthProvider;
  const providerConfigFromEnv = readOAuthProviderConfigFromEnv(provider);
  const { data: existingConnection, error: existingConnectionError } = await admin
    .from("integration_connections")
    .select("config_json")
    .eq("organization_id", authState.organization_id)
    .eq("provider", provider)
    .maybeSingle();
  if (existingConnectionError) {
    return oauthFailure({
      status: 500,
      error: "Failed to load integration configuration",
      code: "data_source_failed",
      diagnosticId: "oauth_callback_connection_load_failed",
      phase: "source_query",
      details: { provider },
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
      diagnosticId: "oauth_callback_provider_missing",
      phase: "dependency_preflight",
      details: {
        dependency: "oauth_provider",
        provider,
        required_env: requiredOAuthEnv(provider),
      },
    });
  }
  const tokenUrl = validateOutboundHttpUrl(providerConfig.tokenUrl);
  if (!tokenUrl) {
    return oauthFailure({
      status: 400,
      error: "OAuth token URL is invalid or unsafe",
      code: "validation_failed",
      diagnosticId: "oauth_callback_token_url_invalid",
      phase: "preflight",
      details: { provider },
    });
  }
  const consumeResult = await consumeOAuthStateForTokenExchange(admin, authState.id);
  if (consumeResult === "replay") {
    return jsonProblem(400, {
      error: "State already used",
      code: "state_already_used",
      diagnostic_id: "oauth_callback_state_replay",
      route: ROUTE,
    });
  }
  if (consumeResult === "error") {
    return oauthFailure({
      status: 500,
      error: "Failed to finalize oauth state",
      code: "persistence_failed",
      diagnosticId: "oauth_callback_state_finalize_failed",
      phase: "persist",
      details: { provider },
    });
  }
  let tokenPayload: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  try {
    const tokenRes = await safeFetch(tokenUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: authState.redirect_uri,
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        code_verifier: authState.code_verifier,
      }).toString(),
      timeoutMs: 20_000,
    });
    if (!tokenRes.ok) {
      return oauthFailure({
        status: 502,
        error: `Token exchange failed: ${tokenRes.status}`,
        code: "upstream_failed",
        diagnosticId: "oauth_callback_token_exchange_failed",
        phase: "source_query",
        details: { provider, upstream_status: tokenRes.status },
      });
    }
    tokenPayload = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
  } catch {
    return oauthFailure({
      status: 502,
      error: "Token exchange failed",
      code: "upstream_failed",
      diagnosticId: "oauth_callback_token_exchange_failed",
      phase: "source_query",
      details: { provider },
    });
  }
  if (!tokenPayload.access_token) {
    return oauthFailure({
      status: 502,
      error: "Token exchange did not return access_token",
      code: "upstream_failed",
      diagnosticId: "oauth_callback_access_token_missing",
      phase: "source_query",
      details: { provider },
    });
  }
  const rawExpiresIn = Number(tokenPayload.expires_in ?? "3600");
  const expiresIn = Number.isFinite(rawExpiresIn) ? rawExpiresIn : 3600;

  const tokenExpiresAt = new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString();
  let encryptedAccessToken: string | null = null;
  let encryptedRefreshToken: string | null = null;
  try {
    encryptedAccessToken = encryptIntegrationToken(tokenPayload.access_token);
    encryptedRefreshToken = encryptIntegrationToken(
      tokenPayload.refresh_token || null
    );
  } catch {
    return oauthFailure({
      status: 503,
      error: "Server encryption key is misconfigured",
      code: "dependency_blocked",
      diagnosticId: "oauth_callback_encryption_key_missing",
      phase: "dependency_preflight",
      details: {
        dependency: "integration_token_encryption",
        required_env: ["INTEGRATION_TOKEN_ENCRYPTION_KEY"],
      },
    });
  }
  const { error: upsertError } = await admin.from("integration_connections").upsert(
    {
      organization_id: authState.organization_id,
      provider: authState.provider,
      status: "connected",
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: tokenExpiresAt,
      connected_account: account,
      oauth_connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "organization_id,provider", ignoreDuplicates: false }
  );
  if (upsertError) {
    return oauthFailure({
      status: 500,
      error: "Failed to persist integration connection",
      code: "persistence_failed",
      diagnosticId: "oauth_callback_connection_persist_failed",
      phase: "persist",
      details: { provider },
    });
  }

  void recordApiRouteAuditEvent(admin, {
    organizationId: authState.organization_id,
    actorUserId: authState.requested_by ?? null,
    actorType: "external",
    route: ROUTE,
    method: "GET",
    action: "api.mutation_authorized",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, provider: authState.provider, tokenExpiresAt });
}
