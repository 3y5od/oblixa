import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createClient, createAdminClient, getDeterministicMembership } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";
import { getRequestOrigin } from "@/lib/app-url";
import * as Sentry from "@sentry/nextjs";
import { isKillBilling, killSwitchJsonResponse } from "@/lib/security/kill-switches";

export async function POST(request: Request) {
  if (isKillBilling()) {
    return killSwitchJsonResponse("billing");
  }
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const membership = await getDeterministicMembership(admin, user.id);

  if (!membership) {
    return NextResponse.json({ error: "No organization membership" }, { status: 400 });
  }

  if (membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`stripe-checkout:${user.id}:${ip}`, RATE_LIMITS.stripeCheckoutSession);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const { data: orgRow, error: orgError } = await admin
    .from("organizations")
    .select("id, name, stripe_customer_id, stripe_subscription_id, stripe_subscription_status")
    .eq("id", membership.organization_id)
    .single();

  if (orgError) {
    console.error("[stripe/checkout] organization query:", orgError.message);
    return NextResponse.json({ error: "Could not load organization" }, { status: 500 });
  }

  if (!orgRow) {
    return NextResponse.json({ error: "No organization membership" }, { status: 400 });
  }
  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) {
    console.error("[stripe/checkout] config:", stripeClient.error);
    return NextResponse.json({ error: "Billing is not configured" }, { status: 500 });
  }
  const stripe = stripeClient.stripe;
  const PRICE_ID = stripeClient.priceId;

  const org = orgRow;

  if (
    org.stripe_subscription_id &&
    (org.stripe_subscription_status === "active" || org.stripe_subscription_status === "trialing")
  ) {
    return NextResponse.json(
      { error: "Organization already has an active subscription" },
      { status: 400 }
    );
  }

  let customerId = org.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: org.name,
      metadata: { organization_id: org.id, user_id: user.id },
    });
    customerId = customer.id;

    const { error: persistCustomerErr } = await admin
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
    if (persistCustomerErr) {
      console.error("[stripe/checkout] persist customer id:", persistCustomerErr.message);
      return NextResponse.json(
        { error: "Could not save billing customer. Try again." },
        { status: 500 }
      );
    }
  }

  const appUrl = getRequestOrigin(request);

  const trialDays = parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS || "", 10);
  const trial =
    Number.isFinite(trialDays) && trialDays > 0
      ? { subscription_data: { trial_period_days: trialDays } }
      : {};

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/settings/billing?success=true`,
      cancel_url: `${appUrl}/settings/billing?canceled=true`,
      metadata: { organization_id: org.id },
      ...trial,
    });
  } catch (err) {
    console.error("[stripe/checkout] sessions.create:", err);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { route: "stripe/checkout" } });
    }
    return NextResponse.json(
      { error: "Checkout could not be started. Try again or contact support." },
      { status: 502 }
    );
  }

  if (!session.url) {
    console.error("[stripe/checkout] session missing url", session.id);
    return NextResponse.json({ error: "Checkout session did not return a URL" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
