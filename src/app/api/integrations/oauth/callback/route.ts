import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { encryptIntegrationToken } from "@/lib/security/token-crypto";
import { readOAuthProviderConfigFromConnection, readOAuthProviderConfigFromEnv } from "@/lib/integrations/oauth-config";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
type OAuthProvider =
  | "google_calendar"
  | "outlook_calendar"
  | "slack"
  | "email"
  | "crm";

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
    return NextResponse.json({ error: "Failed to load oauth state" }, { status: 500 });
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
  const { data: existingConnection } = await admin
    .from("integration_connections")
    .select("config_json")
    .eq("organization_id", authState.organization_id)
    .eq("provider", provider)
    .maybeSingle();
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
    return NextResponse.json(
      { error: "OAuth provider is not configured" },
      { status: 503 }
    );
  }
  const tokenUrl = validateOutboundHttpUrl(providerConfig.tokenUrl);
  if (!tokenUrl) {
    return NextResponse.json(
      { error: "OAuth token URL is invalid or unsafe" },
      { status: 400 }
    );
  }
  let tokenPayload: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  try {
    const tokenRes = await fetch(tokenUrl.toString(), {
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
    });
    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: `Token exchange failed: ${tokenRes.status}` },
        { status: 400 }
      );
    }
    tokenPayload = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
  } catch {
    return NextResponse.json({ error: "Token exchange failed" }, { status: 400 });
  }
  if (!tokenPayload.access_token) {
    return NextResponse.json(
      { error: "Token exchange did not return access_token" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Server encryption key is misconfigured" },
      { status: 503 }
    );
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
    return NextResponse.json({ error: "Failed to persist integration connection" }, { status: 500 });
  }
  const { error: consumeError } = await admin
    .from("integration_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", authState.id);
  if (consumeError) {
    return NextResponse.json({ error: "Failed to finalize oauth state" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, provider: authState.provider, tokenExpiresAt });
}
