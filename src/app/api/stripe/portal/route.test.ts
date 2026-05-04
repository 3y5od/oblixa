import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getDeterministicMembership = vi.fn();
const rateLimitCheck = vi.hoisted(() => vi.fn<typeof import("@/lib/rate-limit").rateLimitCheck>());
const getClientIpFromRequest = vi.hoisted(() => vi.fn(() => "203.0.113.7"));
const portalCreate = vi.hoisted(() => vi.fn());

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
  getStripeClient: vi.fn(async () => ({
    ok: true as const,
    stripe: { billingPortal: { sessions: { create: portalCreate } } },
    priceId: "price_123",
  })),
}));

vi.mock("@/lib/security/kill-switches", () => ({
  isKillBilling: vi.fn(() => false),
  killSwitchJsonResponse: vi.fn(() => new Response(JSON.stringify({ error: "billing disabled" }), { status: 503 })),
}));

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_123";
    rateLimitCheck.mockResolvedValue({ ok: true });
    portalCreate.mockResolvedValue({ id: "bps_123", url: "https://billing.stripe.com/session/bps_123" });
  });

  it("returns 401 when unauthenticated", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/stripe/portal/route");
    const req = new Request("http://localhost:3000/api/stripe/portal", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("creates a portal session with the expected return_url payload shape", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_1" } } }) },
    });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: "cus_123" }, error: null }),
              })),
            })),
          };
        }
        return {};
      }),
    });

    const { POST } = await import("@/app/api/stripe/portal/route");
    const res = await POST(new Request("http://localhost:3000/api/stripe/portal", { method: "POST" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://billing.stripe.com/session/bps_123" });
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:3000/settings/billing",
    });
  });

  it("blocks duplicate replay of portal session start with x-idempotency-key", async () => {
    let idempotencySeen = false;
    rateLimitCheck.mockImplementation(async (key: string, config: unknown) => {
      void config;
      if (key.startsWith("idem:stripe.portal:org_1:user_1:")) {
        if (idempotencySeen) return { ok: false, retryAfterMs: 6000 };
        idempotencySeen = true;
      }
      return { ok: true };
    });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_1" } } }) },
    });
    getDeterministicMembership.mockResolvedValue({ organization_id: "org_1", role: "admin" });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: "cus_123" }, error: null }),
              })),
            })),
          };
        }
        return {};
      }),
    });

    const { POST } = await import("@/app/api/stripe/portal/route");
    const buildRequest = () =>
      new Request("http://localhost:3000/api/stripe/portal", {
        method: "POST",
        headers: { "x-idempotency-key": "portal-replay-0001" },
      });

    const first = await POST(buildRequest());
    const second = await POST(buildRequest());

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ url: "https://billing.stripe.com/session/bps_123" });
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({
      error: "Duplicate request blocked by idempotency key",
      retryAfterMs: 6000,
    });
    expect(portalCreate).toHaveBeenCalledTimes(1);
  });
});

