import type Stripe from "stripe";
import { getStripeServerEnv } from "@/lib/env/server";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "none";

type Ok = { ok: true; stripe: Stripe; priceId: string };
type Err = { ok: false; error: string };

let cached: Ok | null = null;

/**
 * Returns a Stripe SDK client. Loads the `stripe` package on first use so routes
 * that never touch billing do not pay the import cost at cold start.
 */
export async function getStripeClient(): Promise<Ok | Err> {
  if (cached) return cached;
  try {
    const env = getStripeServerEnv();
    const { default: StripeCtor } = await import("stripe");
    const stripe = new StripeCtor(env.secretKey, { typescript: true });
    cached = { ok: true, stripe, priceId: env.priceId };
    return cached;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe env is misconfigured",
    };
  }
}

export function resolveSubscriptionStatus(
  sub: Stripe.Subscription | null | undefined
): SubscriptionStatus {
  if (!sub) return "none";
  if (sub.status === "active") return "active";
  if (sub.status === "trialing") return "trialing";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "incomplete" || sub.status === "incomplete_expired")
    return "incomplete";
  return "canceled";
}
