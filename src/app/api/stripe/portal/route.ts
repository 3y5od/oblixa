import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";
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
    .select("role, organizations(stripe_customer_id)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[stripe/portal] membership query:", membershipError.message);
    return NextResponse.json({ error: "Could not load organization" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  if (membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }
  const stripeClient = getStripeClient();
  if (!stripeClient.ok) {
    console.error("[stripe/portal] config:", stripeClient.error);
    return NextResponse.json({ error: "Billing is not configured" }, { status: 500 });
  }
  const stripe = stripeClient.stripe;

  const customerId = (
    membership.organizations as unknown as { stripe_customer_id: string | null } | null
  )?.stripe_customer_id;

  if (!customerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 });
  }

  const appUrl = getRequestOrigin(request);

  let session: Awaited<ReturnType<typeof stripe.billingPortal.sessions.create>>;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings/billing`,
    });
  } catch (err) {
    console.error("[stripe/portal] billingPortal.sessions.create:", err);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { route: "stripe/portal" } });
    }
    return NextResponse.json(
      { error: "Billing portal could not be opened. Try again or contact support." },
      { status: 502 }
    );
  }

  if (!session.url) {
    console.error("[stripe/portal] session missing url", session.id);
    return NextResponse.json({ error: "Portal did not return a URL" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
