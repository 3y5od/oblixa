import { beforeEach, describe, expect, it, vi } from "vitest";

const processRetriesMock = vi.fn();
const rateLimitCheckMock = vi.fn();
const pingCronHealthcheckMock = vi.fn();
const insertAuditMock = vi.fn();

vi.mock("@/lib/notification-delivery", () => ({
  processNotificationDeliveryRetries: processRetriesMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { notificationsRetryCron: { max: 60, windowMs: 60_000 } },
  rateLimitCheck: rateLimitCheckMock,
}));

vi.mock("@/lib/observability/cron-healthcheck", () => ({
  pingCronHealthcheck: pingCronHealthcheckMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      insert: insertAuditMock,
    })),
  })),
}));

describe("GET /api/notifications/retry-deliveries", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    processRetriesMock.mockReset();
    rateLimitCheckMock.mockReset();
    pingCronHealthcheckMock.mockReset();
    insertAuditMock.mockReset();
    rateLimitCheckMock.mockResolvedValue({ ok: true });
    processRetriesMock.mockResolvedValue({
      scanned: 2,
      delivered: 1,
      failed: 0,
      retried: 1,
      skipped: 0,
      organizationIds: ["org-1"],
    });
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/notifications/retry-deliveries/route");
    const req = new Request("http://localhost:3000/api/notifications/retry-deliveries");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when request is not signed", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/notifications/retry-deliveries/route");
    const req = new Request("http://localhost:3000/api/notifications/retry-deliveries");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });

  it("returns success payload when signed and inserts audit entries", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/notifications/retry-deliveries/route");
    const req = new Request("http://localhost:3000/api/notifications/retry-deliveries", {
      headers: { "x-cron-secret": "cronsecret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      scanned: 2,
      delivered: 1,
      retried: 1,
      organizations: 1,
      ok: true,
    });
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    expect(pingCronHealthcheckMock).toHaveBeenCalled();
  });

  it("returns 429 when route rate limit is exceeded", async () => {
    process.env.CRON_SECRET = "cronsecret";
    rateLimitCheckMock.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    const { GET } = await import("@/app/api/notifications/retry-deliveries/route");
    const req = new Request("http://localhost:3000/api/notifications/retry-deliveries", {
      headers: { "x-cron-secret": "cronsecret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited", retryAfterMs: 5000 });
  });
});
