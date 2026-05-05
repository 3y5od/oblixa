import { NextResponse } from "next/server";
import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { createAdminClient, createClient, getDeterministicMembership } from "@/lib/supabase/server";
import { createHash, randomBytes } from "crypto";
import { getRequestOrigin } from "@/lib/app-url";
import { readOAuthProviderConfigFromEnv, readOAuthProviderConfigFromConnection } from "@/lib/integrations/oauth-config";
import { getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { cookies } from "next/headers";
import { isStepUpCookieValidForUser } from "@/lib/security/step-up-cookie";
import { enforceIdempotency } from "@/lib/idempotency";

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

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`oauth-start:${ip}`, { max: 30, windowMs: 60_000 });
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
  const _lb_body = await readJsonBodyLimited(request);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    provider?: string;
    redirectUri?: string;
  };
  const provider = String(body.provider ?? "").trim();
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }
  const providerId = provider as OAuthProvider;

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const membership = await getDeterministicMembership(admin, user.id);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can start integration auth" }, { status: 403 });
  }
  const jar = await cookies();
  if (!isStepUpCookieValidForUser(jar, user.id)) {
    return NextResponse.json(
      { error: "Step-up required", needStepUp: true },
      { status: 403 }
    );
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
    return NextResponse.json({ error: "Invalid redirectUri" }, { status: 400 });
  }
  if (redirect.origin !== requestOrigin) {
    return NextResponse.json(
      { error: "redirectUri must match request origin" },
      { status: 400 }
    );
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
