import { beforeEach, describe, expect, it, vi } from "vitest";

const constructEvent = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(async () => ({
    ok: true,
    stripe: { webhooks: { constructEvent } },
    priceId: "price_123",
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, rateLimitCheck: vi.fn(async () => ({ ok: true as const })) };
});

vi.mock("@/lib/observability/sentry", () => ({
  captureServerException: vi.fn(),
  captureServerMessage: vi.fn(),
}));

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_123";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns early with duplicate when event id was already processed", async () => {
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
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn(async () => ({ data: { id: "evt_already" }, error: null })),
              }),
            }),
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
});
