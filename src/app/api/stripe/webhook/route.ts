import { jsonOk, jsonProblem, jsonRateLimited, jsonUnsupportedMediaType } from "@/lib/http/problem";
import { getExpectedStripeLivemodeFromEnv, getStripeClient } from "@/lib/stripe";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import type Stripe from "stripe";
import {
  captureServerException,
  captureServerMessage,
} from "@/lib/observability/sentry";
import { readTextBodyLimited } from "@/lib/security/read-json-body-limited";
import { jsonContentTypeRejection } from "@/lib/security/json-content-type";
import { rotatingSecretCandidates } from "@/lib/security/rotating-secret";

const ROUTE = "/api/stripe/webhook";
const STRIPE_WEBHOOK_BODY_MAX = 262_144;
const STRIPE_WEBHOOK_TOLERANCE_SEC = 300;

function stripeDependencyBlocked(input: {
  route: string;
  diagnosticId: string;
  error: string;
  requiredEnv: string[];
}) {
  return jsonProblem(503, {
    error: input.error,
    code: "dependency_blocked",
    diagnostic_id: input.diagnosticId,
    route: input.route,
    details: {
      phase: "dependency_preflight",
      dependency: "stripe_provider",
      required_env: input.requiredEnv,
      degraded_policy: "503 dependency_blocked",
    },
  });
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
    captureServerMessage("STRIPE_WEBHOOK_SECRET is not set", { level: "error" });
    return stripeDependencyBlocked({
      route: "/api/stripe/webhook",
      diagnosticId: "stripe_webhook_secret_missing",
      error: "Stripe webhook secret is not configured",
      requiredEnv: ["STRIPE_WEBHOOK_SECRET"],
    });
  }
  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) {
    console.error("[stripe/webhook] config:", stripeClient.error);
    captureServerMessage(stripeClient.error, { level: "error" });
    return stripeDependencyBlocked({
      route: "/api/stripe/webhook",
      diagnosticId: "stripe_webhook_provider_missing",
      error: "Stripe provider is not configured",
      requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"],
    });
  }
  const stripe = stripeClient.stripe;

  const contentTypeRejection = jsonContentTypeRejection(request);
  if (contentTypeRejection) {
    return jsonUnsupportedMediaType(ROUTE, {
      ...contentTypeRejection.details,
      diagnostic_id: "stripe_webhook_wrong_content_type",
    });
  }

  const _lb_body = await readTextBodyLimited(request, STRIPE_WEBHOOK_BODY_MAX);
  if (!_lb_body.ok) return _lb_body.response;
  const body = _lb_body.body;
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return jsonProblem(400, {
      error: "Missing signature",
      code: "missing_signature",
      diagnostic_id: "stripe_webhook_missing_signature",
      route: ROUTE,
    });
  }

  let event: Stripe.Event | null = null;
  let signatureError: unknown = null;
  try {
    for (const candidateSecret of rotatingSecretCandidates({
      currentSecret: webhookSecret,
      previousSecret: process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS,
      previousSecretExpiresAt: process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT,
    })) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, candidateSecret, STRIPE_WEBHOOK_TOLERANCE_SEC);
        break;
      } catch (err) {
        signatureError = err;
      }
    }
    if (!event) throw signatureError ?? new Error("Stripe signature verification failed");
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    captureServerException(err, { extra: { phase: "constructEvent" } });
    return jsonProblem(400, {
      error: "Invalid signature",
      code: "invalid_signature",
      diagnostic_id: "stripe_webhook_invalid_signature",
      route: ROUTE,
    });
  }

  const expectedLivemode = getExpectedStripeLivemodeFromEnv();
  if (
    expectedLivemode !== null &&
    typeof event.livemode === "boolean" &&
    event.livemode !== expectedLivemode
  ) {
    captureServerMessage("stripe webhook livemode mismatch", {
      level: "error",
      extra: { eventId: event.id, eventType: event.type, expectedLivemode },
    });
    return jsonProblem(400, {
      error: "Stripe webhook mode does not match configured billing mode",
      code: "stripe_mode_mismatch",
      diagnostic_id: "stripe_webhook_livemode_mismatch",
      route: ROUTE,
    });
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`stripe-webhook:${ip}`, RATE_LIMITS.stripeWebhook);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }
  const providerRl = await rateLimitCheck(
    `stripe-webhook:account:${event.account ?? "platform"}:${event.type}`,
    RATE_LIMITS.stripeWebhook
  );
  if (!providerRl.ok) {
    return jsonRateLimited(providerRl.retryAfterMs, ROUTE);
  }

  let supabase: Awaited<ReturnType<typeof createAdminClient>>;
  try {
    supabase = await createAdminClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supabase env misconfigured";
    console.error("[stripe/webhook] configuration error:", message);
    captureServerMessage(message, { level: "error" });
    return jsonProblem(500, {
      error: "Server misconfigured",
      code: "server_misconfigured",
      diagnostic_id: "stripe_webhook_server_misconfigured",
      route: ROUTE,
    });
  }

  const { error: claimErr } = await supabase
    .from("stripe_webhook_events")
    .insert({ id: event.id, status: "processing" });

  if (claimErr) {
    if (claimErr.code === "23505") {
      return jsonOk({ received: true, duplicate: true });
    }
    console.error("[stripe/webhook] could not claim event:", claimErr.message);
    captureServerMessage(claimErr.message, {
      level: "error",
      extra: { eventId: event.id },
    });
    return jsonProblem(500, {
      error: "Could not claim event",
      code: "event_claim_failed",
      diagnostic_id: "stripe_webhook_event_claim_failed",
      route: ROUTE,
    });
  }

  let processingFailed = false;

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
          const { data: existingOrg } = await supabase
            .from("organizations")
            .select("stripe_customer_id")
            .eq("id", orgId)
            .maybeSingle();

          if (existingOrg?.stripe_customer_id && existingOrg.stripe_customer_id !== customerId) {
            captureServerMessage("checkout customer-org binding mismatch", {
              level: "error",
              extra: { orgId, expected: existingOrg.stripe_customer_id, received: customerId },
            });
            break;
          }

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
              processingFailed = true;
              console.error(
                "[stripe/webhook] checkout.session.completed DB update:",
                upErr.message
              );
              captureServerMessage(upErr.message, {
                level: "error",
                extra: { event: event.type, orgId },
              });
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
            processingFailed = true;
            console.error("[stripe/webhook] subscription retrieve failed:", err);
            captureServerException(err, { extra: { event: event.type, orgId } });
          }
        } else if (orgId && session.subscription && !customerId) {
          console.error(
            "[stripe/webhook] checkout.session.completed missing customer id",
            session.id
          );
          captureServerMessage("checkout missing customer id", {
            level: "error",
            extra: { sessionId: session.id },
          });
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
            processingFailed = true;
            console.error("[stripe/webhook] subscription.updated clear:", clearErr.message);
            captureServerMessage(clearErr.message, {
              level: "error",
              extra: { event: event.type, subId: sub.id },
            });
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
            processingFailed = true;
            console.error("[stripe/webhook] subscription.updated DB update:", upErr.message);
            captureServerMessage(upErr.message, {
              level: "error",
              extra: { event: event.type, subId: sub.id },
            });
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
          processingFailed = true;
          console.error("[stripe/webhook] subscription.deleted DB update:", delErr.message);
          captureServerMessage(delErr.message, {
            level: "error",
            extra: { event: event.type, subId: sub.id },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer && typeof invoice.customer === "object" && "id" in invoice.customer
              ? (invoice.customer as Stripe.Customer).id
              : null;
        if (customerId) {
          const { data: orgRow, error: orgErr } = await supabase
            .from("organizations")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (orgErr) {
            processingFailed = true;
            console.error("[stripe/webhook] invoice.payment_failed org lookup:", orgErr.message);
            captureServerMessage(orgErr.message, {
              level: "error",
              extra: { event: event.type },
            });
            break;
          }
          if (orgRow?.id) {
            const { error: upErr } = await supabase
              .from("organizations")
              .update({ stripe_subscription_status: "past_due" })
              .eq("id", orgRow.id);
            if (upErr) {
              processingFailed = true;
              console.error("[stripe/webhook] invoice.payment_failed DB update:", upErr.message);
              captureServerMessage(upErr.message, {
                level: "error",
                extra: { event: event.type },
              });
              break;
            }
            await supabase.from("audit_events").insert({
              organization_id: orgRow.id,
              contract_id: null,
              user_id: null,
              action: "billing.payment_failed",
              details: {
                stripe_event_id: event.id,
                invoice_id: invoice.id,
              },
            });
          }
        }
        console.error(`Payment failed for Stripe customer ${customerId ?? "unknown"}`);
        captureServerMessage("invoice.payment_failed", {
          level: "warning",
          extra: {
            customer: customerId ?? "unknown",
            invoiceId: invoice.id,
          },
        });
        break;
      }
    }

  } catch (err) {
    console.error("[stripe/webhook] handler error:", err);
    captureServerException(err, {
      extra: { eventType: event.type, eventId: event.id },
    });
    await supabase.from("stripe_webhook_events").delete().eq("id", event.id);
    return jsonProblem(500, {
      error: "Webhook processing failed",
      code: "webhook_processing_failed",
      diagnostic_id: "stripe_webhook_processing_failed",
      route: ROUTE,
    });
  }

  if (processingFailed) {
    await supabase.from("stripe_webhook_events").delete().eq("id", event.id);
    return jsonProblem(500, {
      error: "Webhook processing failed",
      code: "webhook_processing_failed",
      diagnostic_id: "stripe_webhook_processing_failed",
      route: ROUTE,
    });
  }

  const { error: completeErr } = await supabase
    .from("stripe_webhook_events")
    .update({ status: "completed" })
    .eq("id", event.id);

  if (completeErr) {
    console.error("[stripe/webhook] could not mark event completed:", completeErr.message);
    captureServerMessage(completeErr.message, {
      level: "error",
      extra: { eventId: event.id },
    });
  }

  return jsonOk({ received: true });
}
