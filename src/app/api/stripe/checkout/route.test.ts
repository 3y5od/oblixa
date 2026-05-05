import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const rateLimitCheck = vi.hoisted(() => vi.fn<typeof import("@/lib/rate-limit").rateLimitCheck>());
const getClientIpFromRequest = vi.hoisted(() => vi.fn(() => "203.0.113.7"));
const checkoutCreate = vi.hoisted(() => vi.fn());
const customersCreate = vi.hoisted(() => vi.fn());
const getStripeClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getDeterministicMembership,
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, rateLimitCheck, getClientIpFromRequest };
});

vi.mock("@/lib/stripe", () => ({
  getStripeClient,
}));

vi.mock("@/lib/security/kill-switches", () => ({
  isKillBilling: vi.fn(() => false),
  killSwitchJsonResponse: vi.fn(() => new Response(JSON.stringify({ error: "billing disabled" }), { status: 503 })),
}));

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_123";
    rateLimitCheck.mockResolvedValue({ ok: true });
    customersCreate.mockResolvedValue({ id: "cus_123" });
    checkoutCreate.mockResolvedValue({ id: "cs_123", url: "https://checkout.stripe.com/session/cs_123" });
    getStripeClient.mockResolvedValue({
      ok: true,
      stripe: {
        customers: { create: customersCreate },
        checkout: { sessions: { create: checkoutCreate } },
      },
      priceId: "price_123",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/stripe/checkout/route");
    const req = new Request("http://localhost:3000/api/stripe/checkout", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("creates a checkout session with the expected billing payload shape", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_1", email: "owner@example.com" } } }) },
    });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "org_1",
                    name: "Acme Corp",
                    stripe_customer_id: "cus_existing",
                    stripe_subscription_id: null,
                    stripe_subscription_status: null,
                  },
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        return { update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) };
      }),
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const res = await POST(new Request("http://localhost:3000/api/stripe/checkout", { method: "POST" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://checkout.stripe.com/session/cs_123" });
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        mode: "subscription",
        line_items: [{ price: "price_123", quantity: 1 }],
        success_url: "http://localhost:3000/settings/billing?success=true",
        cancel_url: "http://localhost:3000/settings/billing?canceled=true",
        metadata: { organization_id: "org_1" },
      })
    );
  });

  it("blocks duplicate replay of checkout session start with x-idempotency-key", async () => {
    let idempotencySeen = false;
    rateLimitCheck.mockImplementation(async (key: string, config: unknown) => {
      void config;
      if (key.startsWith("idem:stripe.checkout:org_1:user_1:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 6000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_1", email: "owner@example.com" } } }) },
    });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "org_1",
                    name: "Acme Corp",
                    stripe_customer_id: "cus_existing",
                    stripe_subscription_id: null,
                    stripe_subscription_status: null,
                  },
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
          };
        }
        return { update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) };
      }),
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const buildRequest = () =>
      new Request("http://localhost:3000/api/stripe/checkout", {
        method: "POST",
        headers: { "x-idempotency-key": "checkout-replay-0001" },
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ url: "https://checkout.stripe.com/session/cs_123" });
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: 6000,
    });
    expect(checkoutCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 503 dependency_blocked when Stripe provider config is unavailable", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_1", email: "owner@example.com" } } }) },
    });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "org_1",
                    name: "Acme Corp",
                    stripe_customer_id: null,
                    stripe_subscription_id: null,
                    stripe_subscription_status: null,
                  },
                  error: null,
                }),
              })),
            })),
          };
        }
        return {};
      }),
    });
    getStripeClient.mockResolvedValueOnce({ ok: false, error: "missing key" });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const res = await POST(new Request("http://localhost:3000/api/stripe/checkout", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      code: "dependency_blocked",
      diagnostic_id: "stripe_checkout_provider_missing",
      phase: "dependency_preflight",
    });
  });
});

