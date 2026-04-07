import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
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
    const orgMembershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { organization_id: orgId, role: "admin" },
      }),
    };
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
        if (table === "organization_members") return orgMembershipQuery;
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
});
