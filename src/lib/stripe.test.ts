import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

describe("stripe helpers", () => {
  describe("resolveSubscriptionStatus", () => {
    it("maps Stripe subscription statuses", async () => {
      const { resolveSubscriptionStatus } = await import("@/lib/stripe");
      expect(resolveSubscriptionStatus(undefined)).toBe("none");
      expect(resolveSubscriptionStatus(null)).toBe("none");
      expect(
        resolveSubscriptionStatus({ status: "active" } as Stripe.Subscription)
      ).toBe("active");
      expect(
        resolveSubscriptionStatus({ status: "trialing" } as Stripe.Subscription)
      ).toBe("trialing");
      expect(
        resolveSubscriptionStatus({ status: "past_due" } as Stripe.Subscription)
      ).toBe("past_due");
      expect(
        resolveSubscriptionStatus({ status: "incomplete" } as Stripe.Subscription)
      ).toBe("incomplete");
      expect(
        resolveSubscriptionStatus({
          status: "incomplete_expired",
        } as Stripe.Subscription)
      ).toBe("incomplete");
      expect(
        resolveSubscriptionStatus({ status: "canceled" } as Stripe.Subscription)
      ).toBe("canceled");
      expect(
        resolveSubscriptionStatus({ status: "paused" } as Stripe.Subscription)
      ).toBe("canceled");
    });
  });

  describe("getStripeClient", () => {
    beforeEach(() => {
      vi.resetModules();
      process.env.STRIPE_SECRET_KEY = "sk_test_123456789012345678901234";
      process.env.STRIPE_PRICE_ID = "price_test_123";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    });

    afterEach(() => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_PRICE_ID;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it("returns a Stripe client when env is valid", async () => {
      const { getStripeClient } = await import("@/lib/stripe");
      const r = await getStripeClient();
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.priceId).toBe("price_test_123");
        expect(typeof r.stripe.webhooks).toBe("object");
      }
    });

    it("returns error when Stripe env is missing", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { getStripeClient } = await import("@/lib/stripe");
      const r = await getStripeClient();
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toMatch(/STRIPE_SECRET_KEY|Stripe env/);
      }
    });
  });
});
