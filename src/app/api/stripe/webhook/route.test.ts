import { beforeEach, describe, expect, it, vi } from "vitest";

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_123";
  });

  it("returns 500 when webhook secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Server misconfigured" });
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Missing signature" });
  });
});
