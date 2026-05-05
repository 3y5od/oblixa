import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { encryptIntegrationToken } from "@/lib/security/token-crypto";
import { readOAuthProviderConfigFromConnection, readOAuthProviderConfigFromEnv } from "@/lib/integrations/oauth-config";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { safeFetch } from "@/lib/security/safe-fetch";
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
  return NextResponse.json(
    {
      ok: false,
      error: input.error,
      code: input.code,
      diagnostic_id: input.diagnosticId,
      phase: input.phase,
      ...(input.details ? { details: input.details } : {}),
    },
    { status: input.status }
  );
}

export async function GET(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`oauth-callback:${ip}`, {
    max: 40,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
        },
      }
    );
  }
  const url = new URL(request.url);
  const state = url.searchParams.get("state")?.trim() ?? "";
  const code = url.searchParams.get("code")?.trim() ?? "";
  const account = url.searchParams.get("account")?.trim() ?? null;
  if (!state || !code) {
    return NextResponse.json({ error: "Missing state or code" }, { status: 400 });
  }

  const admin = await createAdminClient();
  const { data: authState, error: authStateError } = await admin
    .from("integration_oauth_states")
    .select(
      "id, organization_id, provider, consumed_at, expires_at, redirect_uri, code_verifier, code_challenge_method"
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
  if (!authState) return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  if (authState.consumed_at) {
    return NextResponse.json({ error: "State already used" }, { status: 400 });
  }
  if (new Date(authState.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "State expired" }, { status: 400 });
  }
  if (!authState.redirect_uri || !authState.code_verifier) {
    return NextResponse.json(
      { error: "OAuth state is incomplete" },
      { status: 400 }
    );
  }
  const provider = authState.provider as OAuthProvider;
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
  const { error: consumeError } = await admin
    .from("integration_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", authState.id);
  if (consumeError) {
    return oauthFailure({
      status: 500,
      error: "Failed to finalize oauth state",
      code: "persistence_failed",
      diagnosticId: "oauth_callback_state_finalize_failed",
      phase: "persist",
      details: { provider },
    });
  }

  return NextResponse.json({ ok: true, provider: authState.provider, tokenExpiresAt });
}
