import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe, PRICE_ID } from "@/lib/stripe";
import { getRequestOrigin } from "@/lib/app-url";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, stripe_customer_id, stripe_subscription_id)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[stripe/checkout] membership query:", membershipError.message);
    return NextResponse.json({ error: "Could not load organization" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "No organization membership" }, { status: 400 });
  }

  if (membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  };

  if (org.stripe_subscription_id) {
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
