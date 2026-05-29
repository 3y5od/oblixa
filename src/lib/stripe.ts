import type Stripe from "stripe";
import { getStripeMonthlyPriceId, getStripeServerEnv } from "@/lib/env/server";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused"
  | "none";

type Ok = {
  ok: true;
  stripe: Stripe;
  priceId: string;
  monthlyPriceId: string | null;
};
type Err = { ok: false; error: string };

let cached: Ok | null = null;

export type StripeCredentialMode = "test" | "live" | "restricted" | "unknown";
type StripeEnvironment = Record<string, string | undefined>;

export function stripeCredentialMode(secretKey: string | null | undefined): StripeCredentialMode {
  const key = secretKey?.trim() ?? "";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("rk_live_") || key.startsWith("rk_test_")) return "restricted";
  return "unknown";
}

export function getExpectedStripeLivemodeFromEnv(env: StripeEnvironment = process.env): boolean | null {
  const explicit = env.STRIPE_EXPECTED_MODE?.trim().toLowerCase();
  if (explicit === "live") return true;
  if (explicit === "test") return false;
  const mode = stripeCredentialMode(env.STRIPE_SECRET_KEY);
  if (mode === "live") return true;
  if (mode === "test") return false;
  return null;
}

export function assertStripeEnvironmentConsistency(env: StripeEnvironment = process.env): void {
  const expected = env.STRIPE_EXPECTED_MODE?.trim().toLowerCase();
  if (expected && expected !== "live" && expected !== "test") {
    throw new Error("STRIPE_EXPECTED_MODE must be live or test");
  }

  const mode = stripeCredentialMode(env.STRIPE_SECRET_KEY);
  if ((expected === "live" && mode === "test") || (expected === "test" && mode === "live")) {
    throw new Error("Stripe test/live key mismatch");
  }

  const productionLike = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  if (productionLike && mode === "test" && env.ALLOW_STRIPE_TEST_MODE_IN_PRODUCTION !== "1") {
    throw new Error("Stripe test mode is not allowed in production");
  }
}

/**
 * Returns a Stripe SDK client. Loads the `stripe` package on first use so routes
 * that never touch billing do not pay the import cost at cold start.
 *
 * SPEC: docs/billing-page-maximal-pass.md §3.3, §3.11 — pinned apiVersion;
 * maxNetworkRetries for transient failure recovery (§15.4).
 */
export async function getStripeClient(): Promise<Ok | Err> {
  if (cached) return cached;
  try {
    const env = getStripeServerEnv();
    assertStripeEnvironmentConsistency(process.env);
    const monthlyPriceId = getStripeMonthlyPriceId();
    const { default: StripeCtor } = await import("stripe");
    // SPEC: §3.11 — pin apiVersion so future Stripe-side default flips
    // don't silently shift response shapes. Override via env if needed.
    const apiVersionOverride =
      typeof process.env.STRIPE_API_VERSION === "string" &&
      process.env.STRIPE_API_VERSION.trim().length > 0
        ? (process.env.STRIPE_API_VERSION.trim() as unknown as undefined)
        : undefined;
    const stripe = new StripeCtor(env.secretKey, {
      typescript: true,
      maxNetworkRetries: 2,
      ...(apiVersionOverride ? { apiVersion: apiVersionOverride } : {}),
    });
    cached = { ok: true, stripe, priceId: env.priceId, monthlyPriceId };
    return cached;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe env is misconfigured",
    };
  }
}

/**
 * Resolve a Stripe price ID by variant. Falls back to annual when monthly
 * is not configured. Used by the checkout server action (§3.9).
 */
export function resolvePriceIdForVariant(
  client: { priceId: string; monthlyPriceId: string | null },
  variant: "annual" | "monthly" | undefined
): string {
  if (variant === "monthly" && client.monthlyPriceId) {
    return client.monthlyPriceId;
  }
  return client.priceId;
}

export function resolveSubscriptionStatus(
  sub: Stripe.Subscription | null | undefined
): SubscriptionStatus {
  if (!sub) return "none";
  if (sub.status === "active") return "active";
  if (sub.status === "trialing") return "trialing";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "incomplete") return "incomplete";
  if (sub.status === "incomplete_expired") return "incomplete_expired";
  if (sub.status === "unpaid") return "unpaid";
  if (sub.status === "paused") return "paused";
  return "canceled";
}
