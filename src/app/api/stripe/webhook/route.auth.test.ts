import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/sentry", () => ({
  captureServerException: vi.fn(),
  captureServerMessage: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(),
}));

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const { getStripeClient } = await import("@/lib/stripe");
    vi.mocked(getStripeClient).mockResolvedValue({
      ok: true,
      stripe: {} as Stripe,
      priceId: "price_test",
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Missing signature" });
  });
});
