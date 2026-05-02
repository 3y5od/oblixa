import { beforeEach, describe, expect, it, vi } from "vitest";

const constructEvent = vi.fn();
const getStripeClient = vi.hoisted(() =>
  vi.fn(async () => ({
    ok: true as const,
    stripe: { webhooks: { constructEvent } },
    priceId: "price_123",
  }))
);
const createAdminClient = vi.fn();
const rateLimitCheck = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })));

vi.mock("@/lib/stripe", () => ({
  getStripeClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, rateLimitCheck };
});

vi.mock("@/lib/observability/sentry", () => ({
  captureServerException: vi.fn(),
  captureServerMessage: vi.fn(),
}));

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getStripeClient.mockImplementation(async () => ({
      ok: true as const,
      stripe: { webhooks: { constructEvent } },
      priceId: "price_123",
    }));
    rateLimitCheck.mockResolvedValue({ ok: true });
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_123";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns duplicate for replayed Stripe event id (out-of-order / at-least-once delivery)", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    constructEvent.mockReturnValue({
      id: "evt_already",
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_x", id: "in_x" } },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "stripe_webhook_events") {
          return {
            insert: vi.fn(async () => ({
              error: { code: "23505", message: "duplicate key" },
            })),
          };
        }
        return {};
      }),
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);
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

  it("returns 400 when constructEvent rejects (invalid signature)", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid signature" });
  });

  it("returns 429 when rate limited", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    constructEvent.mockReturnValue({
      id: "evt_rl",
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_x", id: "in_x" } },
    });
    rateLimitCheck.mockImplementationOnce(
      async () =>
        ({ ok: false, retryAfterMs: 5000 }) as unknown as Awaited<ReturnType<typeof rateLimitCheck>>
    );
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig", "x-forwarded-for": "203.0.113.5" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 500 when Stripe client is misconfigured", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    getStripeClient.mockImplementationOnce(
      async () =>
        ({ ok: false, error: "missing key" }) as unknown as Awaited<ReturnType<typeof getStripeClient>>
    );
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "sig" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server misconfigured" });
  });
});
