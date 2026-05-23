import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const hasSensitiveActionProof = vi.fn();
const recordSecurityAuditEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/security/sensitive-action-proof", () => ({
  hasSensitiveActionProof,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent,
}));

function buildAuthClient(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  };
}

describe("POST /api/integrations/oauth/start", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    hasSensitiveActionProof.mockResolvedValue(true);
    recordSecurityAuditEvent.mockResolvedValue("audit-1");
  });

  it("returns 400 for unsupported provider", async () => {
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    getDeterministicMembership.mockResolvedValue({ organization_id: orgId, role: "admin" });
    createClient.mockResolvedValue(buildAuthClient(userId));
    createAdminClient.mockResolvedValue({
      from: vi.fn(),
    });
    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const req = new Request("http://localhost:3000/api/integrations/oauth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "not-supported",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "Unsupported provider" });
  });

  it("returns 500 when oauth state insert fails", async () => {
    process.env.OAUTH_SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
    process.env.OAUTH_SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
    process.env.OAUTH_SLACK_CLIENT_ID = "cid";
    process.env.OAUTH_SLACK_CLIENT_SECRET = "csecret";
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    getDeterministicMembership.mockResolvedValue({
      organization_id: orgId,
      role: "admin",
    });
    const oauthStateInsert = vi.fn().mockResolvedValue({
      error: { message: "insert failed" },
    });

    createClient.mockResolvedValue(buildAuthClient(userId));
    const integrationConnectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return { insert: oauthStateInsert };
        if (table === "integration_connections") return integrationConnectionQuery;
        return {};
      }),
    });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const req = new Request("http://localhost:3000/api/integrations/oauth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "slack",
        redirectUri: "http://localhost:3000/api/integrations/oauth/callback",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toMatchObject({
      error: "Failed to create oauth state",
      code: "persistence_failed",
      diagnostic_id: "oauth_start_state_create_failed",
    });
    expect(oauthStateInsert).toHaveBeenCalledTimes(1);
  });

  it("returns 503 dependency_blocked when the OAuth provider is not configured", async () => {
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    delete process.env.OAUTH_SLACK_AUTHORIZE_URL;
    delete process.env.OAUTH_SLACK_TOKEN_URL;
    delete process.env.OAUTH_SLACK_CLIENT_ID;
    delete process.env.OAUTH_SLACK_CLIENT_SECRET;
    getDeterministicMembership.mockResolvedValue({ organization_id: orgId, role: "admin" });
    createClient.mockResolvedValue(buildAuthClient(userId));
    createAdminClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const res = await POST(
      new Request("http://localhost:3000/api/integrations/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "slack", redirectUri: "http://localhost:3000/api/integrations/oauth/callback" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "oauth_start_provider_missing",
    });
  });

  it("returns 403 for non-admin membership before provider configuration DB work", async () => {
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const from = vi.fn();
    getDeterministicMembership.mockResolvedValue({ organization_id: orgId, role: "viewer" });
    createClient.mockResolvedValue(buildAuthClient(userId));
    createAdminClient.mockResolvedValue({ from });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const res = await POST(
      new Request("http://localhost:3000/api/integrations/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "slack", redirectUri: "http://localhost:3000/api/integrations/oauth/callback" }),
      })
    );

    expect(res.status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });

  it("requires shared step-up or AAL2 proof before creating oauth state", async () => {
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const from = vi.fn();
    getDeterministicMembership.mockResolvedValue({ organization_id: orgId, role: "admin" });
    hasSensitiveActionProof.mockResolvedValueOnce(false);
    createClient.mockResolvedValue(buildAuthClient(userId));
    createAdminClient.mockResolvedValue({ from });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const res = await POST(
      new Request("http://localhost:3000/api/integrations/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "slack",
          redirectUri: "http://localhost:3000/api/integrations/oauth/callback",
        }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({
      code: "step_up_required",
      diagnostic_id: "oauth_start_step_up_required",
      details: { needStepUp: true },
    });
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "security.integration_oauth_start_blocked",
        outcome: "forbidden",
        safeMetadata: { reason: "sensitive_action_proof_required" },
      })
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("returns authorizeUrl payload shape with PKCE S256 challenge when state insert succeeds", async () => {
    process.env.OAUTH_SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
    process.env.OAUTH_SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
    process.env.OAUTH_SLACK_CLIENT_ID = "cid";
    process.env.OAUTH_SLACK_CLIENT_SECRET = "csecret";
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    getDeterministicMembership.mockResolvedValue({
      organization_id: orgId,
      role: "admin",
    });
    const oauthStateInsert = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue(buildAuthClient(userId));
    const integrationConnectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return { insert: oauthStateInsert };
        if (table === "integration_connections") return integrationConnectionQuery;
        return {};
      }),
    });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const req = new Request("http://localhost:3000/api/integrations/oauth/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "slack",
        redirectUri: "http://localhost:3000/api/integrations/oauth/callback",
      }),
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok?: boolean; authorizeUrl?: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    const authorizeUrl = new URL(String(body.authorizeUrl));
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(authorizeUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizeUrl.searchParams.get("client_id")).toBe("cid");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/integrations/oauth/callback");
    expect(authorizeUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizeUrl.searchParams.get("state")).toBeTruthy();
    expect(oauthStateInsert).toHaveBeenCalledTimes(1);
    const row = oauthStateInsert.mock.calls[0][0] as { code_challenge_method?: string };
    expect(row.code_challenge_method).toBe("S256");
  });

  it("rejects same-origin redirectUri values that are not the OAuth callback route", async () => {
    process.env.OAUTH_SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
    process.env.OAUTH_SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
    process.env.OAUTH_SLACK_CLIENT_ID = "cid";
    process.env.OAUTH_SLACK_CLIENT_SECRET = "csecret";
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    getDeterministicMembership.mockResolvedValue({
      organization_id: orgId,
      role: "admin",
    });
    const oauthStateInsert = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue(buildAuthClient(userId));
    const integrationConnectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return { insert: oauthStateInsert };
        if (table === "integration_connections") return integrationConnectionQuery;
        return {};
      }),
    });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const res = await POST(
      new Request("http://localhost:3000/api/integrations/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "slack",
          redirectUri: "http://localhost:3000/settings/integrations",
        }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "redirectUri must match OAuth callback route",
      diagnostic_id: "oauth_start_redirect_path_mismatch",
    });
    expect(oauthStateInsert).not.toHaveBeenCalled();
  });

  it("rejects OAuth callback redirectUri values with query strings", async () => {
    process.env.OAUTH_SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
    process.env.OAUTH_SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
    process.env.OAUTH_SLACK_CLIENT_ID = "cid";
    process.env.OAUTH_SLACK_CLIENT_SECRET = "csecret";
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    getDeterministicMembership.mockResolvedValue({
      organization_id: orgId,
      role: "admin",
    });
    const oauthStateInsert = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue(buildAuthClient(userId));
    const integrationConnectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return { insert: oauthStateInsert };
        if (table === "integration_connections") return integrationConnectionQuery;
        return {};
      }),
    });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const res = await POST(
      new Request("http://localhost:3000/api/integrations/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "slack",
          redirectUri: "http://localhost:3000/api/integrations/oauth/callback?next=/settings",
        }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "redirectUri must match OAuth callback route",
      diagnostic_id: "oauth_start_redirect_path_mismatch",
    });
    expect(oauthStateInsert).not.toHaveBeenCalled();
  });

  it("blocks duplicate replay of oauth start with x-idempotency-key", async () => {
    process.env.OAUTH_SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
    process.env.OAUTH_SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
    process.env.OAUTH_SLACK_CLIENT_ID = "cid";
    process.env.OAUTH_SLACK_CLIENT_SECRET = "csecret";
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    getDeterministicMembership.mockResolvedValue({
      organization_id: orgId,
      role: "admin",
    });
    const oauthStateInsert = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue(buildAuthClient(userId));
    const integrationConnectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return { insert: oauthStateInsert };
        if (table === "integration_connections") return integrationConnectionQuery;
        return {};
      }),
    });

    const { POST } = await import("@/app/api/integrations/oauth/start/route");
    const buildRequest = () =>
      new Request("http://localhost:3000/api/integrations/oauth/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "oauth-start-replay-0001",
        },
        body: JSON.stringify({
          provider: "slack",
          redirectUri: "http://localhost:3000/api/integrations/oauth/callback",
        }),
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: expect.any(Number),
    });
    expect(oauthStateInsert).toHaveBeenCalledTimes(1);
  });

  it("authenticates before parsing the request body", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/integrations/oauth/start/route.ts"), "utf8");
    const authIndex = source.indexOf("supabase.auth.getUser()");
    const bodyParseIndex = source.indexOf("readJsonBodyLimited(request)");

    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(bodyParseIndex).toBeGreaterThanOrEqual(0);
    expect(authIndex).toBeLessThan(bodyParseIndex);
  });
});
