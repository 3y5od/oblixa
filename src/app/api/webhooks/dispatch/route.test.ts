import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const authorizeCronRequest = vi.fn();
const rateLimitCheck = vi.fn();
const pingCronHealthcheck = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/security/cron-auth", () => ({
  authorizeCronRequest,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    webhooksDispatchCron: { max: 60, windowMs: 60_000 },
  },
  rateLimitCheck,
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck,
}));

describe("GET /api/webhooks/dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeCronRequest.mockReturnValue(false);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when authorization header is missing", async () => {
    process.env.CRON_SECRET = "secret";
    authorizeCronRequest.mockReturnValue(false);
    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });

  it("returns diagnostics payload when authorized with eventId", async () => {
    process.env.CRON_SECRET = "secret";
    authorizeCronRequest.mockReturnValue(true);
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(
          table === "outbound_events"
            ? { data: { id: "evt_1", delivered: false } }
            : { data: null }
        ),
        order: vi.fn().mockResolvedValue({
          data: table === "outbound_event_deliveries" ? [{ id: "del_1", delivered: false }] : [],
        }),
      })),
    });

    const { GET } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch?eventId=evt_1");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      diagnostics: {
        event: { id: "evt_1", delivered: false },
        deliveries: [{ id: "del_1", delivered: false }],
      },
      ok: true,
    });
  });
});

describe("POST /api/webhooks/dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeCronRequest.mockReturnValue(false);
    rateLimitCheck.mockResolvedValue({ ok: true });
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "replay_event", eventId: "evt_1" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 400 for unsupported actions even when authorized", async () => {
    process.env.CRON_SECRET = "secret";
    authorizeCronRequest.mockReturnValue(true);
    const { POST } = await import("@/app/api/webhooks/dispatch/route");
    const req = new Request("http://localhost:3000/api/webhooks/dispatch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret",
      },
      body: JSON.stringify({ action: "bad_action" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Unsupported action" });
  });
});

