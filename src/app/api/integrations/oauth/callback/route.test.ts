import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const safeFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch,
}));

describe("GET /api/integrations/oauth/callback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    safeFetch.mockReset();
    // Force in-memory rate-limit path in tests to avoid Upstash client calls.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.OAUTH_SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
    process.env.OAUTH_SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
    process.env.OAUTH_SLACK_CLIENT_ID = "cid";
    process.env.OAUTH_SLACK_CLIENT_SECRET = "csecret";
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.from(
      "12345678901234567890123456789012"
    ).toString("base64");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 when state or code is missing", async () => {
    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=&code=x")
    );
    expect(res.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects unsafe callback state before database lookup", async () => {
    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=valid%0Astate&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "Invalid state",
      diagnostic_id: "oauth_callback_invalid_state",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects oversized callback code before database lookup", async () => {
    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request(
        `http://localhost:3000/api/integrations/oauth/callback?state=test-state&code=${"a".repeat(2049)}`
      )
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "Invalid code",
      diagnostic_id: "oauth_callback_invalid_code",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 when oauth state row is missing (invalid state)", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });
    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request(
        "http://localhost:3000/api/integrations/oauth/callback?state=not-in-db&code=auth_code"
      )
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid state" });
  });

  it("returns 400 when oauth state already used", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: crypto.randomUUID(),
          organization_id: crypto.randomUUID(),
          provider: "slack",
          consumed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
          code_verifier: "verifier",
          code_challenge_method: "S256",
        },
        error: null,
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=used&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "State already used" });
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when oauth state is expired", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: crypto.randomUUID(),
          organization_id: crypto.randomUUID(),
          provider: "slack",
          consumed_at: null,
          expires_at: new Date(Date.now() - 60_000).toISOString(),
          redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
          code_verifier: "verifier",
          code_challenge_method: "S256",
        },
        error: null,
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=expired&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error: "State expired" });
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when oauth state provider is unsupported", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: crypto.randomUUID(),
          organization_id: crypto.randomUUID(),
          provider: "not-supported",
          consumed_at: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
          code_verifier: "verifier",
          code_challenge_method: "S256",
        },
        error: null,
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=test&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "Unsupported provider",
      diagnostic_id: "oauth_callback_provider_unsupported",
    });
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when oauth state redirect_uri is not the callback route", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: crypto.randomUUID(),
          organization_id: crypto.randomUUID(),
          provider: "slack",
          consumed_at: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          redirect_uri: "http://localhost:3000/settings/integrations",
          code_verifier: "verifier",
          code_challenge_method: "S256",
        },
        error: null,
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=test&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "Invalid redirect URI",
      diagnostic_id: "oauth_callback_redirect_uri_invalid",
    });
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when oauth state redirect_uri contains a query string", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: crypto.randomUUID(),
          organization_id: crypto.randomUUID(),
          provider: "slack",
          consumed_at: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          redirect_uri: "http://localhost:3000/api/integrations/oauth/callback?next=/settings",
          code_verifier: "verifier",
          code_challenge_method: "S256",
        },
        error: null,
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=test-state&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "Invalid redirect URI",
      diagnostic_id: "oauth_callback_redirect_uri_invalid",
    });
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when oauth state does not require S256 PKCE", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: crypto.randomUUID(),
          organization_id: crypto.randomUUID(),
          provider: "slack",
          consumed_at: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
          code_verifier: "verifier",
          code_challenge_method: "plain",
        },
        error: null,
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=test-state&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "OAuth state is incomplete",
      diagnostic_id: "oauth_callback_pkce_method_invalid",
    });
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 500 when loading oauth state fails", async () => {
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "query failed" },
      }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const req = new Request(
      "http://localhost:3000/api/integrations/oauth/callback?state=test&code=auth_code"
    );
    const res = await GET(req);
    const fullBody = await res.json();
    const body = { error: fullBody.error };

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to load oauth state" });
    expect(fullBody).toMatchObject({
      error: "Failed to load oauth state",
      code: "data_source_failed",
      diagnostic_id: "oauth_callback_state_load_failed",
    });
  });

  it("returns 500 when persisting integration connection fails", async () => {
    const authStateId = crypto.randomUUID();
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            id: authStateId,
            organization_id: crypto.randomUUID(),
            provider: "slack",
            consumed_at: null,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
            code_verifier: "verifier",
            code_challenge_method: "S256",
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: authStateId }, error: null }),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    };
    safeFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: "access_token",
        refresh_token: "refresh_token",
        expires_in: 3600,
      }),
    });
    const upsert = vi.fn().mockResolvedValue({ error: { message: "upsert failed" } });
    const integrationConnectionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        if (table === "integration_connections") {
          return {
            ...integrationConnectionQuery,
            upsert,
          };
        }
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const req = new Request(
      "http://localhost:3000/api/integrations/oauth/callback?state=test&code=auth_code"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({
      error: "Failed to persist integration connection",
      code: "persistence_failed",
      diagnostic_id: "oauth_callback_connection_persist_failed",
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("returns 502 upstream_failed when token exchange rejects upstream", async () => {
    const authStateId = crypto.randomUUID();
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            id: authStateId,
            organization_id: "org_1",
            provider: "slack",
            consumed_at: null,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
            code_verifier: "verifier",
            code_challenge_method: "S256",
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: authStateId }, error: null }),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    };
    safeFetch.mockResolvedValue({ ok: false, status: 502 });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        if (table === "integration_connections") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=test&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toMatchObject({
      code: "upstream_failed",
      diagnostic_id: "oauth_callback_token_exchange_failed",
    });
  });

  it("sends a schema-compatible token exchange payload fields and persists the connection", async () => {
    const authStateId = crypto.randomUUID();
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            id: authStateId,
            organization_id: "org_1",
            provider: "slack",
            consumed_at: null,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
            code_verifier: "verifier-123",
            code_challenge_method: "S256",
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: authStateId }, error: null }),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    };
    const upsert = vi.fn().mockResolvedValue({ error: null });
    safeFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: "access_token",
        refresh_token: "refresh_token",
        expires_in: 3600,
      }),
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        if (table === "integration_connections") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            upsert,
          };
        }
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const req = new Request(
      "http://localhost:3000/api/integrations/oauth/callback?state=test-state&code=auth_code&account=acct_123"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, provider: "slack", tokenExpiresAt: expect.any(String) });
    expect(safeFetch).toHaveBeenCalledWith(
      "https://slack.com/api/oauth.v2.access",
      expect.objectContaining({
        method: "POST",
        timeoutMs: 20_000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
    const sentBody = new URLSearchParams(String(safeFetch.mock.calls[0]?.[1]?.body ?? ""));
    expect(Object.fromEntries(sentBody.entries())).toMatchObject({
      grant_type: "authorization_code",
      code: "auth_code",
      redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
      client_id: "cid",
      client_secret: "csecret",
      code_verifier: "verifier-123",
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org_1",
        provider: "slack",
        status: "connected",
        connected_account: "acct_123",
      }),
      { onConflict: "organization_id,provider", ignoreDuplicates: false }
    );
  });

  it("returns 400 and skips token exchange when state was consumed concurrently", async () => {
    const authStateId = crypto.randomUUID();
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            id: authStateId,
            organization_id: "org_1",
            provider: "slack",
            consumed_at: null,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            redirect_uri: "http://localhost:3000/api/integrations/oauth/callback",
            code_verifier: "verifier-123",
            code_challenge_method: "S256",
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    };
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "integration_oauth_states") return authStateQuery;
        if (table === "integration_connections") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    });

    const { GET } = await import("@/app/api/integrations/oauth/callback/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/oauth/callback?state=test-state&code=auth_code")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "State already used",
      diagnostic_id: "oauth_callback_state_replay",
    });
    expect(authStateQuery.update).toHaveBeenCalledWith({ consumed_at: expect.any(String) });
    expect(authStateQuery.is).toHaveBeenCalledWith("consumed_at", null);
    expect(safeFetch).not.toHaveBeenCalled();
  });
});
