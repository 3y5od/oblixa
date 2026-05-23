import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitCheck = vi.fn();
const enforceIdempotency = vi.fn();

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitCheck,
  };
});

vi.mock("@/lib/idempotency", () => ({
  enforceIdempotency,
}));

describe("GET /api/cron/stripe-webhook-events", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = originalCronSecret;
    rateLimitCheck.mockResolvedValue({ ok: true });
    enforceIdempotency.mockResolvedValue(null);
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/stripe-webhook-events/route");
    const req = new Request("http://localhost:3000/api/cron/stripe-webhook-events");

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("cron_secret_missing");
  });

  it("returns 401 when auth header is missing", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/cron/stripe-webhook-events/route");
    const req = new Request("http://localhost:3000/api/cron/stripe-webhook-events");

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", code: "cron_unauthorized" });
  });

  it("returns 429 when rate limited", async () => {
    process.env.CRON_SECRET = "cronsecret";
    rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 10_000 });
    const { GET } = await import("@/app/api/cron/stripe-webhook-events/route");
    const req = new Request("http://localhost:3000/api/cron/stripe-webhook-events", {
      headers: { Authorization: "Bearer cronsecret" },
    });

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", code: "rate_limited", retryAfterMs: 10_000 });
  });

  it("returns replay response before rate limiting or cleanup work", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const replay = new Response(JSON.stringify({ error: "Duplicate request" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
    enforceIdempotency.mockResolvedValueOnce(replay);

    const { GET } = await import("@/app/api/cron/stripe-webhook-events/route");
    const req = new Request("http://localhost:3000/api/cron/stripe-webhook-events", {
      headers: {
        Authorization: "Bearer cronsecret",
        "x-idempotency-key": "stripe-cleanup-replay-0001",
      },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Duplicate request" });
    expect(enforceIdempotency).toHaveBeenCalledWith(expect.any(Request), {
      scope: "cron:/api/cron/stripe-webhook-events",
      actorKey: "cron",
    });
    expect(rateLimitCheck).not.toHaveBeenCalled();
  });
});
