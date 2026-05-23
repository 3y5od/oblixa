import "server-only";
import { cache } from "react";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";

// SPEC: docs/billing-page-maximal-pass.md §15.3 — Stripe call timeout.
// Default Stripe SDK has no client-side timeout in Next serverless
// environments; a hung connection can leave the page hanging.
export async function withTimeout<T>(
  promise: Promise<T>,
  ms = 5_000,
  label = "stripe call"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// SPEC: §15.6 — in-request cache for the configured price retrieve.
// React `cache()` dedupes per-request automatically.
export const retrieveConfiguredPrice = cache(
  async (priceId: string): Promise<Stripe.Price | null> => {
    const stripeClient = await getStripeClient();
    if (!stripeClient.ok) return null;
    try {
      return await withTimeout(
        stripeClient.stripe.prices.retrieve(priceId),
        5_000,
        `prices.retrieve(${priceId})`
      );
    } catch {
      return null;
    }
  }
);

// SPEC: §3.23 — Handle multi-subscription customers. Returns the
// most-recent active subscription when more than one exists.
export async function listCustomerSubscriptions(
  customerId: string
): Promise<{ active: Stripe.Subscription | null; all: Stripe.Subscription[] }> {
  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) return { active: null, all: [] };
  try {
    const result = await withTimeout(
      stripeClient.stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 5,
        expand: [
          "data.items.data.price",
          "data.latest_invoice",
          "data.discount.coupon",
        ],
      }),
      5_000,
      "subscriptions.list"
    );
    const all = result.data;
    const active =
      all.find(
        (s) => s.status === "active" || s.status === "trialing"
      ) ?? all[0] ?? null;
    return { active, all };
  } catch {
    return { active: null, all: [] };
  }
}
