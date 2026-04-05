import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

export const PRICE_ID = "price_1TIwJnEXnVa6i8gyaqSFXZi9";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

export function resolveSubscriptionStatus(
  sub: Stripe.Subscription | null | undefined
): SubscriptionStatus {
  if (!sub) return "none";
  if (sub.status === "active") return "active";
  if (sub.status === "trialing") return "trialing";
  if (sub.status === "past_due") return "past_due";
  return "canceled";
}
