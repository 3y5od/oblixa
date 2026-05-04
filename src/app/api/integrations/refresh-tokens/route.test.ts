import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.hoisted(() => vi.fn());
const rateLimitCheck = vi.hoisted(() => vi.fn<typeof import("@/lib/rate-limit").rateLimitCheck>());
const decryptIntegrationToken = vi.hoisted(() => vi.fn());
const encryptIntegrationToken = vi.hoisted(() => vi.fn());
const validateOutboundHttpUrl = vi.hoisted(() => vi.fn());
const safeFetch = vi.hoisted(() => vi.fn());
const pingCronHealthcheck = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/security/token-crypto", () => ({
  decryptIntegrationToken,
  encryptIntegrationToken,
}));

vi.mock("@/lib/security/url-policy", () => ({
  validateOutboundHttpUrl,
}));

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch,
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck,
}));

function createRefreshAdmin(rows: Array<Record<string, unknown>>) {
  const integrationUpdateEq = vi.fn(async () => ({ error: null }));
  return {
    admin: {
      from: vi.fn((table: string) => {
        if (table === "integration_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    limit: vi.fn(async () => ({ data: rows, error: null })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: integrationUpdateEq })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
}

describe("GET /api/integrations/refresh-tokens", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cronsecret";
    rateLimitCheck.mockResolvedValue({ ok: true });
    decryptIntegrationToken.mockReturnValue("decrypted-refresh-token");
    encryptIntegrationToken.mockImplementation((value: string) => `enc:${value}`);
    validateOutboundHttpUrl.mockImplementation((url: string) => new URL(url));
    safeFetch.mockResolvedValue(
      new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 1800 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const { admin } = createRefreshAdmin([]);
    createAdminClient.mockResolvedValue(admin as never);
  });

  it("returns 401 when cron auth header is missing", async () => {
    const { GET } = await import("@/app/api/integrations/refresh-tokens/route");
    const req = new Request("http://localhost:3000/api/integrations/refresh-tokens");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 503 when cron auth env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/integrations/refresh-tokens/route");
    const req = new Request("http://localhost:3000/api/integrations/refresh-tokens");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("posts the refresh payload field shape and persists refreshed token fields", async () => {
    const row = {
      id: "conn_1",
      provider: "slack",
      refresh_token: "encrypted-refresh-token",
      token_expires_at: new Date(Date.now() + 60_000).toISOString(),
      config_json: {
        tokenRefreshUrl: "https://slack.com/api/oauth.v2.access",
        clientId: "client-id",
        clientSecret: "client-secret",
        scope: "chat:write,channels:read",
      },
    };
    const { admin } = createRefreshAdmin([row]);
    createAdminClient.mockResolvedValue(admin as never);

    const { GET } = await import("@/app/api/integrations/refresh-tokens/route");
    const res = await GET(
      new Request("http://localhost:3000/api/integrations/refresh-tokens", {
        headers: { authorization: "Bearer cronsecret" },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      route: "/api/integrations/refresh-tokens",
      scanned: 1,
      attempted: 1,
      refreshed: 1,
      failed: 0,
    });
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
      grant_type: "refresh_token",
      refresh_token: "decrypted-refresh-token",
      client_id: "client-id",
      client_secret: "client-secret",
      scope: "chat:write,channels:read",
    });
    expect(encryptIntegrationToken).toHaveBeenNthCalledWith(1, "new-access");
    expect(encryptIntegrationToken).toHaveBeenNthCalledWith(2, "new-refresh");
  });

  it("blocks duplicate replay of refresh-tokens cron runs with x-idempotency-key", async () => {
    let idempotencySeen = false;
    rateLimitCheck.mockImplementation(async (key: string, config: unknown) => {
      void config;
      if (key.startsWith("idem:cron:/api/integrations/refresh-tokens:cron:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 6000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });
    const row = {
      id: "conn_1",
      provider: "slack",
      refresh_token: "encrypted-refresh-token",
      token_expires_at: new Date(Date.now() + 60_000).toISOString(),
      config_json: {
        tokenRefreshUrl: "https://slack.com/api/oauth.v2.access",
        clientId: "client-id",
        clientSecret: "client-secret",
      },
    };
    const { admin } = createRefreshAdmin([row]);
    createAdminClient.mockResolvedValue(admin as never);

    const { GET } = await import("@/app/api/integrations/refresh-tokens/route");
    const buildRequest = () =>
      new Request("http://localhost:3000/api/integrations/refresh-tokens", {
        headers: {
          authorization: "Bearer cronsecret",
          "x-idempotency-key": "refresh-tokens-replay-0001",
        },
      });

    const first = await GET(buildRequest());
    const second = await GET(buildRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: 6000,
    });
    expect(safeFetch).toHaveBeenCalledTimes(1);
  });
});

