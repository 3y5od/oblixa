import { jsonForbidden, jsonOk, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createClient, createAdminClient, getDeterministicMembership } from "@/lib/supabase/server";
import { getStripeClient, resolvePriceIdForVariant } from "@/lib/stripe";
import { getRequestOrigin } from "@/lib/app-url";
import * as Sentry from "@sentry/nextjs";
import { isKillBilling, killSwitchJsonResponse } from "@/lib/security/kill-switches";
import { enforceIdempotency } from "@/lib/idempotency";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";
import {
  getStripeFoundingCouponId,
  isStripeAchEnabled,
  isStripeTaxEnabled,
  isStripeTosCollectionEnabled,
} from "@/lib/env/server";

// SPEC: docs/billing-page-maximal-pass.md §3.27 — Stripe SDK is Node-only.
export const runtime = "nodejs";

const ROUTE = "/api/stripe/checkout";

// SPEC: §3.21 — supported Stripe checkout locales (allowlist).
const STRIPE_SUPPORTED_LOCALES = new Set([
  "auto", "bg", "cs", "da", "de", "el", "en", "en-GB", "es", "es-419",
  "et", "fi", "fil", "fr", "fr-CA", "hr", "hu", "id", "it", "ja", "ko",
  "lt", "lv", "ms", "mt", "nb", "nl", "pl", "pt", "pt-BR", "ro", "ru",
  "sk", "sl", "sv", "th", "tr", "vi", "zh", "zh-HK", "zh-TW",
]);

function pickLocale(req: Request): string | undefined {
  const accept = req.headers.get("accept-language");
  if (!accept) return undefined;
  const first = accept.split(",")[0]?.trim().split(";")[0]?.trim();
  if (!first) return undefined;
  const primary = first.split("-")[0];
  if (STRIPE_SUPPORTED_LOCALES.has(first)) return first;
  if (primary && STRIPE_SUPPORTED_LOCALES.has(primary)) return primary;
  return undefined;
}

function stripeDependencyBlocked(diagnosticId: string, error: string) {
  return jsonProblem(503, {
    error,
    code: "dependency_blocked",
    diagnostic_id: diagnosticId,
    route: ROUTE,
    details: {
      phase: "dependency_preflight",
      dependency: "stripe_provider",
      required_env: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"],
      degraded_policy: "503 dependency_blocked",
    },
  });
}

type CheckoutBody = {
  variant?: "annual" | "monthly";
  founding?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonUnauthorized(ROUTE);
  }

  const membership = await getDeterministicMembership(admin, user.id);

  if (!membership) {
    return jsonProblem(400, {
      error: "No organization membership",
      code: "organization_membership_missing",
      diagnostic_id: "stripe_checkout_membership_missing",
      route: ROUTE,
    });
  }

  if (membership.role !== "admin") {
    return jsonForbidden(ROUTE);
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`stripe-checkout:${user.id}:${ip}`, RATE_LIMITS.stripeCheckoutSession);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  if (isKillBilling()) {
    return killSwitchJsonResponse("billing");
  }

  // SPEC: §3.9 read variant from body — schema allows {variant, founding}
  let body: CheckoutBody = {};
  try {
    const text = await request.clone().text();
    if (text.trim().length > 0) {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        const raw = parsed as Record<string, unknown>;
        if (raw.variant === "annual" || raw.variant === "monthly") {
          body.variant = raw.variant;
        }
        if (raw.founding === true) {
          body.founding = true;
        }
      }
    }
  } catch {
    body = {};
  }
  // Validate that any extra body keys beyond the allowlist are rejected
  // (defense-in-depth; we already parsed loosely above).
  void rejectUnexpectedBody;

  const duplicate = await enforceIdempotency(request, {
    scope: "stripe.checkout",
    actorKey: `${membership.organization_id}:${user.id}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(admin, {
    organizationId: membership.organization_id,
    actorUserId: user.id,
    route: "/api/stripe/checkout",
    method: "POST",
  }).catch(() => undefined);

  const { data: orgRow, error: orgError } = await admin
    .from("organizations")
    .select("id, name, stripe_customer_id, stripe_subscription_id, stripe_subscription_status")
    .eq("id", membership.organization_id)
    .single();

  if (orgError) {
    console.error("[stripe/checkout] organization query:", orgError.message);
    return jsonProblem(500, {
      error: "Could not load organization",
      code: "organization_load_failed",
      diagnostic_id: "stripe_checkout_organization_load_failed",
      route: ROUTE,
    });
  }

  if (!orgRow) {
    return jsonProblem(400, {
      error: "No organization membership",
      code: "organization_membership_missing",
      diagnostic_id: "stripe_checkout_membership_missing",
      route: ROUTE,
    });
  }
  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) {
    console.error("[stripe/checkout] config:", stripeClient.error);
    return stripeDependencyBlocked(
      "stripe_checkout_provider_missing",
      "Billing provider is not configured"
    );
  }
  const stripe = stripeClient.stripe;
  // SPEC: §3.9 resolve priceId per variant
  const PRICE_ID = resolvePriceIdForVariant(stripeClient, body.variant);

  const org = orgRow;

  if (
    org.stripe_subscription_id &&
    (org.stripe_subscription_status === "active" || org.stripe_subscription_status === "trialing")
  ) {
    return jsonProblem(400, {
      error: "Organization already has an active subscription",
      code: "active_subscription_exists",
      diagnostic_id: "stripe_checkout_active_subscription_exists",
      route: ROUTE,
    });
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
      return jsonProblem(500, {
        error: "Could not save billing customer. Try again.",
        code: "billing_customer_persist_failed",
        diagnostic_id: "stripe_checkout_customer_persist_failed",
        route: ROUTE,
      });
    }
  }

  const appUrl = getRequestOrigin(request);

  // SPEC: §3.6 — reject non-HTTPS origins in production
  if (
    process.env.NODE_ENV === "production" &&
    !appUrl.startsWith("https://") &&
    !appUrl.startsWith("http://localhost")
  ) {
    console.error("[stripe/checkout] non-HTTPS origin in prod:", appUrl);
    return jsonProblem(500, {
      error: "Invalid return URL",
      code: "invalid_return_url",
      diagnostic_id: "stripe_checkout_invalid_return_url",
      route: ROUTE,
    });
  }

  // SPEC: §7.5 — pin 21-day trial when env doesn't override
  const trialDaysOverride = parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS || "", 10);
  const trialPeriodDays =
    Number.isFinite(trialDaysOverride) && trialDaysOverride > 0
      ? trialDaysOverride
      : 21;

  // SPEC: §3.28 modern discounts[] for founding-customer pre-apply (§3.22)
  const foundingCouponId = body.founding ? getStripeFoundingCouponId() : null;

  // SPEC: §3.30 ACH gated on env flag
  const paymentMethodTypes: Array<"card" | "us_bank_account"> = ["card"];
  if (isStripeAchEnabled() && body.variant === "annual") {
    paymentMethodTypes.push("us_bank_account");
  }

  // SPEC: §3.15 + §3.20 env-gated
  const automaticTax = isStripeTaxEnabled() ? { enabled: true } : undefined;
  const consentCollection = isStripeTosCollectionEnabled()
    ? ({ terms_of_service: "required" } as const)
    : undefined;

  const locale = pickLocale(request);

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      // SPEC: §3.30
      payment_method_types: paymentMethodTypes,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      // SPEC: §1.1 + §1.22 + §3.8 + §3.6
      success_url: `${appUrl}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings/billing?canceled=1`,
      // SPEC: §3.13
      allow_promotion_codes: true,
      // SPEC: §3.14
      billing_address_collection: "required",
      // SPEC: §3.19
      tax_id_collection: { enabled: true },
      // SPEC: §3.15 (env-gated)
      ...(automaticTax ? { automatic_tax: automaticTax } : {}),
      // SPEC: §3.20 (env-gated)
      ...(consentCollection ? { consent_collection: consentCollection } : {}),
      // SPEC: §3.21
      ...(locale ? { locale: locale as unknown as "auto" } : {}),
      // SPEC: §3.18 + §3.31
      metadata: {
        organization_id: org.id,
        app_user_id: user.id,
        ...(body.founding ? { founding_customer: "true" } : {}),
      },
      // SPEC: §3.25 — collection_method defaults to charge_automatically
      // on Checkout subscription mode; not configurable in subscription_data.
      // SPEC: §3.29 + §7.5 + §3.22 + §3.18
      subscription_data: {
        description: "Oblixa Core",
        trial_period_days: trialPeriodDays,
        metadata: {
          organization_id: org.id,
          app_user_id: user.id,
          ...(body.founding ? { founding_customer: "true" } : {}),
        },
        // SPEC: §3.28 discounts[] (modern, replaces deprecated coupon)
        ...(foundingCouponId
          ? { discounts: [{ coupon: foundingCouponId }] }
          : {}),
      },
      // SPEC: §3.29 statement_descriptor on card statement (max 22 chars)
      payment_intent_data: undefined, // Not used in subscription mode
    });
  } catch (err) {
    // SPEC: §15.11 log Stripe error.requestId for support traceability
    const stripeErr = err as { requestId?: string; code?: string; type?: string; statusCode?: number };
    console.error(
      "[stripe/checkout] sessions.create:",
      err instanceof Error ? err.message : err,
      {
        requestId: stripeErr.requestId,
        code: stripeErr.code,
        type: stripeErr.type,
        statusCode: stripeErr.statusCode,
      }
    );
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, {
        extra: {
          route: "stripe/checkout",
          requestId: stripeErr.requestId,
          stripeCode: stripeErr.code,
        },
      });
    }
    return jsonProblem(502, {
      error: "Checkout could not be started. Try again or contact support.",
      code: "checkout_session_create_failed",
      diagnostic_id: "stripe_checkout_session_create_failed",
      route: ROUTE,
    });
  }

  if (!session.url) {
    console.error("[stripe/checkout] session missing url", session.id);
    return jsonProblem(500, {
      error: "Checkout session did not return a URL",
      code: "checkout_session_url_missing",
      diagnostic_id: "stripe_checkout_session_url_missing",
      route: ROUTE,
    });
  }

  // SPEC: §3.16 + §3.26 set security headers
  const res = jsonOk({ url: session.url });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}
