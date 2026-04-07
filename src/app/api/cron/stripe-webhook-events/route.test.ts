import { beforeEach, describe, expect, it } from "vitest";

describe("GET /api/cron/stripe-webhook-events", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 500 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/stripe-webhook-events/route");
    const req = new Request("http://localhost:3000/api/cron/stripe-webhook-events");

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Server misconfigured: CRON_SECRET is not set" });
  });

  it("returns 401 when auth header is missing", async () => {
    process.env.CRON_SECRET = "cronsecret";
    const { GET } = await import("@/app/api/cron/stripe-webhook-events/route");
    const req = new Request("http://localhost:3000/api/cron/stripe-webhook-events");

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
