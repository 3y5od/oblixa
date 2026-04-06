import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";

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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage("STRIPE_WEBHOOK_SECRET is not set", { level: "error" });
    }
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { phase: "constructEvent" } });
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  const { data: alreadyDone } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (alreadyDone) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organization_id;
        const rawCustomer = session.customer;
        const customerId =
          typeof rawCustomer === "string"
            ? rawCustomer
            : rawCustomer &&
                typeof rawCustomer === "object" &&
                "id" in rawCustomer &&
                typeof (rawCustomer as { id: unknown }).id === "string"
              ? (rawCustomer as Stripe.Customer).id
              : null;

        if (orgId && session.subscription && customerId) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            const periodEnd = subscriptionPeriodEndIso(sub);
            const { error: upErr } = await supabase
              .from("organizations")
              .update({
                stripe_customer_id: customerId,
                stripe_subscription_id: subId,
                stripe_subscription_status: sub.status,
                ...(periodEnd
                  ? { stripe_subscription_current_period_end: periodEnd }
                  : {}),
              })
              .eq("id", orgId);
            if (upErr) {
              console.error(
                "[stripe/webhook] checkout.session.completed DB update:",
                upErr.message
              );
              if (process.env.SENTRY_DSN) {
                Sentry.captureMessage(upErr.message, {
                  level: "error",
                  extra: { event: event.type, orgId },
                });
              }
            } else {
              await supabase.from("audit_events").insert({
                organization_id: orgId,
                contract_id: null,
                user_id: null,
                action: "billing.checkout_completed",
                details: {
                  stripe_event_id: event.id,
                  subscription_id: subId,
                },
              });
            }
          } catch (err) {
            console.error("[stripe/webhook] subscription retrieve failed:", err);
            if (process.env.SENTRY_DSN) {
              Sentry.captureException(err, { extra: { event: event.type, orgId } });
            }
          }
        } else if (orgId && session.subscription && !customerId) {
          console.error(
            "[stripe/webhook] checkout.session.completed missing customer id",
            session.id
          );
          if (process.env.SENTRY_DSN) {
            Sentry.captureMessage("checkout missing customer id", {
              level: "error",
              extra: { sessionId: session.id },
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const periodEnd = subscriptionPeriodEndIso(sub);
        const terminal =
          sub.status === "canceled" ||
          sub.status === "unpaid" ||
          sub.status === "incomplete_expired";

        if (terminal) {
          const { error: clearErr } = await supabase
            .from("organizations")
            .update({
              stripe_subscription_id: null,
              stripe_subscription_status: null,
              stripe_subscription_current_period_end: null,
            })
            .eq("stripe_subscription_id", sub.id);
          if (clearErr) {
            console.error("[stripe/webhook] subscription.updated clear:", clearErr.message);
            if (process.env.SENTRY_DSN) {
              Sentry.captureMessage(clearErr.message, {
                level: "error",
                extra: { event: event.type, subId: sub.id },
              });
            }
          }
        } else {
          const { error: upErr } = await supabase
            .from("organizations")
            .update({
              stripe_subscription_status: sub.status,
              ...(periodEnd
                ? { stripe_subscription_current_period_end: periodEnd }
                : {}),
            })
            .eq("stripe_subscription_id", sub.id);
          if (upErr) {
            console.error("[stripe/webhook] subscription.updated DB update:", upErr.message);
            if (process.env.SENTRY_DSN) {
              Sentry.captureMessage(upErr.message, {
                level: "error",
                extra: { event: event.type, subId: sub.id },
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error: delErr } = await supabase
          .from("organizations")
          .update({
            stripe_subscription_id: null,
            stripe_subscription_status: null,
            stripe_subscription_current_period_end: null,
          })
          .eq("stripe_subscription_id", sub.id);
        if (delErr) {
          console.error("[stripe/webhook] subscription.deleted DB update:", delErr.message);
          if (process.env.SENTRY_DSN) {
            Sentry.captureMessage(delErr.message, {
              level: "error",
              extra: { event: event.type, subId: sub.id },
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.error(`Payment failed for customer ${invoice.customer}`);
        if (process.env.SENTRY_DSN) {
          Sentry.captureMessage("invoice.payment_failed", {
            level: "warning",
            extra: {
              customer: invoice.customer,
              invoiceId: invoice.id,
            },
          });
        }
        break;
      }
    }

    const { error: recordErr } = await supabase
      .from("stripe_webhook_events")
      .insert({ id: event.id });

    if (recordErr && recordErr.code !== "23505") {
      console.error("[stripe/webhook] could not record processed event:", recordErr.message);
      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage(recordErr.message, {
          level: "error",
          extra: { eventId: event.id },
        });
      }
      return NextResponse.json({ error: "Could not finalize event" }, { status: 500 });
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { eventType: event.type, eventId: event.id } });
    }
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
