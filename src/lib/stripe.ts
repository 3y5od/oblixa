import Stripe from "stripe";
import { getStripeServerEnv } from "@/lib/env/server";

const stripeEnv = getStripeServerEnv();

export const stripe = new Stripe(stripeEnv.secretKey, {
  typescript: true,
});

export const PRICE_ID = stripeEnv.priceId;

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
