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

  it("returns duplicate payload shape for replayed Stripe event id (out-of-order / at-least-once delivery)", async () => {
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
    const body = (await res.json()) as { received?: boolean; duplicate?: boolean };
    expect(body).toEqual({ received: true, duplicate: true });
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
    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "stripe_webhook_secret_missing",
    });
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
    expect(body).toMatchObject({
      error: "Missing signature",
      code: "missing_signature",
      diagnostic_id: "stripe_webhook_missing_signature",
    });
  });

  it("rejects oversized webhook bodies before signature verification or DB access", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: {
        "content-length": "9999999",
        "stripe-signature": "sig",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
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
    expect(await res.json()).toMatchObject({
      error: "Invalid signature",
      code: "invalid_signature",
      diagnostic_id: "stripe_webhook_invalid_signature",
    });
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
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "stripe_webhook_provider_missing",
    });
  });

  it("returns received payload shape when customer.subscription.updated is canceled (terminal)", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    constructEvent.mockReturnValue({
      id: "evt_sub_terminal",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_terminal",
          status: "canceled",
          items: { data: [{ current_period_end: 1_700_000_000 }] },
        },
      },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "stripe_webhook_events") {
          return {
            insert: vi.fn(async () => ({ error: null })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        if (table === "organizations") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
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
    expect(await res.json()).toEqual({ received: true });
  });

  it("does not bind checkout to an org when a valid signature carries a mismatched customer", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const retrieve = vi.fn();
    getStripeClient.mockImplementationOnce(async () => ({
      ok: true as const,
      stripe: { webhooks: { constructEvent }, subscriptions: { retrieve } },
      priceId: "price_123",
    }));
    constructEvent.mockReturnValue({
      id: "evt_checkout_mismatch",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_mismatch",
          metadata: { organization_id: "org_1" },
          subscription: "sub_1",
          customer: "cus_received",
        },
      },
    });
    const organizationUpdate = vi.fn();
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "stripe_webhook_events") {
          return {
            insert: vi.fn(async () => ({ error: null })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { stripe_customer_id: "cus_expected" },
                  error: null,
                })),
              })),
            })),
            update: organizationUpdate,
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
    expect(retrieve).not.toHaveBeenCalled();
    expect(organizationUpdate).not.toHaveBeenCalled();
  });
});
