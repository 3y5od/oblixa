import { beforeEach, describe, expect, it, vi } from "vitest";
import { WEBHOOK_CALLBACK_FIXTURES } from "@/lib/security/webhook-callback-fixtures";

const constructEvent = vi.fn();
const getExpectedStripeLivemodeFromEnv = vi.hoisted(() => vi.fn(() => null as boolean | null));
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
  getExpectedStripeLivemodeFromEnv,
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

function stripeFixture(id: string) {
  const fixture = WEBHOOK_CALLBACK_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) throw new Error(`Missing Stripe webhook fixture: ${id}`);
  return fixture;
}

function stripeWebhookRequest(
  body = "{}",
  headers: Record<string, string> = { "stripe-signature": "sig" }
): Request {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getStripeClient.mockImplementation(async () => ({
      ok: true as const,
      stripe: { webhooks: { constructEvent } },
      priceId: "price_123",
    }));
    getExpectedStripeLivemodeFromEnv.mockReturnValue(null);
    rateLimitCheck.mockResolvedValue({ ok: true });
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_123";
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT;
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
    const req = stripeWebhookRequest(stripeFixture("stripe-duplicate-delivery").body ?? "{}");
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
    const req = stripeWebhookRequest("{}", {});

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
        "content-type": "application/json",
        "content-length": "9999999",
        "stripe-signature": "sig",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 415 when Stripe webhook content type is not JSON", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const fixture = stripeFixture("stripe-wrong-content-type");
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      body: fixture.body,
      headers: fixture.headers,
    });

    const res = await POST(req);
    expect(res.status).toBe(fixture.expectedStatus);
    expect(await res.json()).toMatchObject({
      code: "unsupported_media_type",
      details: { diagnostic_id: "stripe_webhook_wrong_content_type" },
    });
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
    const req = stripeWebhookRequest(stripeFixture("stripe-bad-signature").body ?? "{}");
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Invalid signature",
      code: "invalid_signature",
      diagnostic_id: "stripe_webhook_invalid_signature",
    });
  });

  it("accepts a valid previous Stripe webhook secret during bounded rotation", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_current";
    process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS = "whsec_previous";
    process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT = "2099-01-01T00:00:00.000Z";
    constructEvent.mockImplementation((_body: string, _signature: string, secret: string) => {
      if (secret === "whsec_previous") {
        return {
          id: "evt_previous_secret",
          type: "invoice.payment_failed",
          data: { object: { customer: "cus_x", id: "in_x" } },
        };
      }
      throw new Error("bad sig");
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
    const res = await POST(stripeWebhookRequest("{}"));

    expect(res.status).toBe(200);
    expect(constructEvent).toHaveBeenCalledTimes(2);
    expect(constructEvent).toHaveBeenNthCalledWith(1, "{}", "sig", "whsec_current", 300);
    expect(constructEvent).toHaveBeenNthCalledWith(2, "{}", "sig", "whsec_previous", 300);
  });

  it("rejects an expired previous Stripe webhook secret during rotation", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_current";
    process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS = "whsec_previous";
    process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT = "2000-01-01T00:00:00.000Z";
    constructEvent.mockImplementation((_body: string, _signature: string, secret: string) => {
      if (secret === "whsec_previous") {
        return {
          id: "evt_previous_secret",
          type: "invoice.payment_failed",
          data: { object: { customer: "cus_x", id: "in_x" } },
        };
      }
      throw new Error("bad sig");
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(stripeWebhookRequest("{}"));

    expect(res.status).toBe(400);
    expect(constructEvent).toHaveBeenCalledTimes(1);
    expect(constructEvent).toHaveBeenCalledWith("{}", "sig", "whsec_current", 300);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 when Stripe signature timestamp is stale", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const fixture = stripeFixture("stripe-stale-timestamp");
    constructEvent.mockImplementation(() => {
      throw new Error("Timestamp outside the tolerance zone");
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(stripeWebhookRequest(fixture.body ?? "{}", fixture.headers ?? {}));

    expect(res.status).toBe(fixture.expectedStatus);
    expect(await res.json()).toMatchObject({
      error: "Invalid signature",
      code: "invalid_signature",
      diagnostic_id: "stripe_webhook_invalid_signature",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a valid Stripe webhook whose livemode does not match the configured test/live mode", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    constructEvent.mockReturnValue({
      id: "evt_wrong_mode",
      type: "invoice.payment_failed",
      livemode: true,
      data: { object: { customer: "cus_x", id: "in_x" } },
    });
    getExpectedStripeLivemodeFromEnv.mockReturnValue(false);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(stripeWebhookRequest(stripeFixture("stripe-wrong-mode").body ?? "{}"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: "stripe_mode_mismatch",
      diagnostic_id: "stripe_webhook_livemode_mismatch",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 when the signed Stripe payload is malformed", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const fixture = stripeFixture("stripe-malformed-payload");
    constructEvent.mockImplementation(() => {
      throw new SyntaxError("Unexpected end of JSON input");
    });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(stripeWebhookRequest(fixture.body ?? "{}", fixture.headers ?? {}));

    expect(res.status).toBe(fixture.expectedStatus);
    expect(await res.json()).toMatchObject({
      code: "invalid_signature",
      diagnostic_id: "stripe_webhook_invalid_signature",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
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
    const req = stripeWebhookRequest("{}", { "stripe-signature": "sig", "x-forwarded-for": "203.0.113.5" });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 503 provider outage when Stripe client is misconfigured", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    getStripeClient.mockImplementationOnce(
      async () =>
        ({ ok: false, error: "missing key" }) as unknown as Awaited<ReturnType<typeof getStripeClient>>
    );
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = stripeWebhookRequest(stripeFixture("stripe-provider-outage").body ?? "{}");
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      code: "dependency_blocked",
      diagnostic_id: "stripe_webhook_provider_missing",
    });
  });

  it("accepts an unknown Stripe event family after durable claim without organization mutation", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const fixture = stripeFixture("stripe-unknown-event");
    const eventUpdate = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    const organizationsFrom = vi.fn();
    constructEvent.mockReturnValue({
      id: "evt_fixture_unknown",
      type: "customer.tax_id.created",
      data: { object: { id: "txi_unknown" } },
    });
    createAdminClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "stripe_webhook_events") {
          return {
            insert: vi.fn(async () => ({ error: null })),
            update: eventUpdate,
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        if (table === "organizations") return organizationsFrom(table);
        return {};
      }),
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(stripeWebhookRequest(fixture.body ?? "{}", fixture.headers ?? {}));

    expect(res.status).toBe(fixture.expectedStatus);
    expect(await res.json()).toEqual({ received: true });
    expect(eventUpdate).toHaveBeenCalledWith({ status: "completed" });
    expect(organizationsFrom).not.toHaveBeenCalled();
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
    const req = stripeWebhookRequest();
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it("marks billing state past_due and audits invoice.payment_failed events", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    const organizationUpdate = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    constructEvent.mockReturnValue({
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      livemode: false,
      data: {
        object: {
          id: "in_failed",
          customer: "cus_failed",
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
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "org_failed" },
                  error: null,
                })),
              })),
            })),
            update: organizationUpdate,
          };
        }
        if (table === "audit_events") {
          return { insert: auditInsert };
        }
        return {};
      }),
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(stripeWebhookRequest());

    expect(res.status).toBe(200);
    expect(organizationUpdate).toHaveBeenCalledWith({ stripe_subscription_status: "past_due" });
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org_failed",
        action: "billing.payment_failed",
        details: expect.objectContaining({
          stripe_event_id: "evt_invoice_failed",
          invoice_id: "in_failed",
        }),
      })
    );
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
    const req = stripeWebhookRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
    expect(organizationUpdate).not.toHaveBeenCalled();
  });
});
