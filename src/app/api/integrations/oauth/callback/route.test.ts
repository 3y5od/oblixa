import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

describe("GET /api/integrations/oauth/callback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OAUTH_SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
    process.env.OAUTH_SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
    process.env.OAUTH_SLACK_CLIENT_ID = "cid";
    process.env.OAUTH_SLACK_CLIENT_SECRET = "csecret";
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.from(
      "12345678901234567890123456789012"
    ).toString("base64");
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
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to load oauth state" });
  });

  it("returns 500 when persisting integration connection fails", async () => {
    const authStateId = crypto.randomUUID();
    const authStateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
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
      }),
      update: vi.fn().mockReturnThis(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "access_token",
          refresh_token: "refresh_token",
          expires_in: 3600,
        }),
      })
    );
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
    expect(body).toEqual({ error: "Failed to persist integration connection" });
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
