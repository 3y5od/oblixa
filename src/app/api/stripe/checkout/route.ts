import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe, PRICE_ID } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, stripe_customer_id, stripe_subscription_id)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
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

    await admin
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const trialDays = parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS || "", 10);
  const trial =
    Number.isFinite(trialDays) && trialDays > 0
      ? { subscription_data: { trial_period_days: trialDays } }
      : {};

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?success=true`,
    cancel_url: `${appUrl}/settings/billing?canceled=true`,
    metadata: { organization_id: org.id },
    ...trial,
  });

  return NextResponse.json({ url: session.url });
}
