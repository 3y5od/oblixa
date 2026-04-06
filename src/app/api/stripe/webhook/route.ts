import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import type Stripe from "stripe";

function getAdminSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

function subscriptionPeriodEndIso(sub: Stripe.Subscription): string | null {
  const first = sub.items?.data?.[0];
  if (first && typeof first.current_period_end === "number") {
    return new Date(first.current_period_end * 1000).toISOString();
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.organization_id;
      if (orgId && session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        const periodEnd = subscriptionPeriodEndIso(sub);
        await supabase
          .from("organizations")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subId,
            stripe_subscription_status: sub.status,
            ...(periodEnd
              ? { stripe_subscription_current_period_end: periodEnd }
              : {}),
          })
          .eq("id", orgId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const periodEnd = subscriptionPeriodEndIso(sub);
      await supabase
        .from("organizations")
        .update({
          stripe_subscription_status: sub.status,
          ...(periodEnd
            ? { stripe_subscription_current_period_end: periodEnd }
            : {}),
        })
        .eq("stripe_subscription_id", sub.id);

      if (
        sub.status === "canceled" ||
        sub.status === "unpaid" ||
        sub.status === "incomplete_expired"
      ) {
        await supabase
          .from("organizations")
          .update({
            stripe_subscription_id: null,
            stripe_subscription_status: null,
            stripe_subscription_current_period_end: null,
          })
          .eq("stripe_subscription_id", sub.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("organizations")
        .update({
          stripe_subscription_id: null,
          stripe_subscription_status: null,
          stripe_subscription_current_period_end: null,
        })
        .eq("stripe_subscription_id", sub.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.error(`Payment failed for customer ${invoice.customer}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
