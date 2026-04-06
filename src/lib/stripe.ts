import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

export const PRICE_ID = process.env.STRIPE_PRICE_ID!;

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
