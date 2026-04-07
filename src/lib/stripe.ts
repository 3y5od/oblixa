import Stripe from "stripe";
import { getStripeServerEnv } from "@/lib/env/server";

let cachedStripe: Stripe | null = null;
let cachedPriceId: string | null = null;

function readStripeConfig():
  | { ok: true; secretKey: string; priceId: string }
  | { ok: false; error: string } {
  try {
    const env = getStripeServerEnv();
    return { ok: true, secretKey: env.secretKey, priceId: env.priceId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe env is misconfigured",
    };
  }
}

export function getStripeClient():
  | { ok: true; stripe: Stripe; priceId: string }
  | { ok: false; error: string } {
  if (cachedStripe && cachedPriceId) {
    return { ok: true, stripe: cachedStripe, priceId: cachedPriceId };
  }
  const cfg = readStripeConfig();
  if (!cfg.ok) return cfg;
  cachedStripe = new Stripe(cfg.secretKey, { typescript: true });
  cachedPriceId = cfg.priceId;
  return { ok: true, stripe: cachedStripe, priceId: cachedPriceId };
}

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "none";

export function resolveSubscriptionStatus(
  sub: Stripe.Subscription | null | undefined
): SubscriptionStatus {
  if (!sub) return "none";
  if (sub.status === "active") return "active";
  if (sub.status === "trialing") return "trialing";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "incomplete" || sub.status === "incomplete_expired") return "incomplete";
  return "canceled";
}
