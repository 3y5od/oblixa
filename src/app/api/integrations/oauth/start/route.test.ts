import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/security/step-up-cookie", () => ({
  isStepUpCookieValidForUser: vi.fn().mockReturnValue(true),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "test-step-up" }),
  }),
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
  });

  it("returns 400 for unsupported provider", async () => {
    createClient.mockResolvedValue(buildAuthClient(crypto.randomUUID()));
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
    expect(body).toEqual({ error: "Unsupported provider" });
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
    expect(body).toEqual({ error: "Failed to create oauth state" });
    expect(oauthStateInsert).toHaveBeenCalledTimes(1);
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
});
