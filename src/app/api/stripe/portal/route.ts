import { jsonForbidden, jsonOk, jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
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
import { enforceIdempotency } from "@/lib/idempotency";
import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

// SPEC: docs/billing-page-maximal-pass.md §3.27 — Stripe SDK is Node-only.
export const runtime = "nodejs";

const ROUTE = "/api/stripe/portal";

// SPEC: §3.4 — map `?return=` to Stripe billing portal `flow_data.type`.
const PORTAL_FLOW_MAP: Record<string, "subscription_cancel" | "subscription_update" | "payment_method_update" | "subscription_update_confirm"> = {
  cancel: "subscription_cancel",
  update: "subscription_update",
  payment_method: "payment_method_update",
};

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
      error: "No organization",
      code: "organization_missing",
      diagnostic_id: "stripe_portal_organization_missing",
      route: ROUTE,
    });
  }

  if (membership.role !== "admin") {
    return jsonForbidden(ROUTE);
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`stripe-portal:${user.id}:${ip}`, RATE_LIMITS.stripePortalSession);
  if (!rl.ok) {
    return jsonRateLimited(rl.retryAfterMs, ROUTE);
  }

  if (isKillBilling()) {
    return killSwitchJsonResponse("billing");
  }

  const unexpectedBody = await rejectUnexpectedBody(request);
  if (unexpectedBody) return unexpectedBody;

  const duplicate = await enforceIdempotency(request, {
    scope: "stripe.portal",
    actorKey: `${membership.organization_id}:${user.id}`,
  });
  if (duplicate) return duplicate;

  void recordApiMutationAuditEvent(admin, {
    organizationId: membership.organization_id,
    actorUserId: user.id,
    route: "/api/stripe/portal",
    method: "POST",
  }).catch(() => undefined);

  const { data: orgRow, error: orgError } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", membership.organization_id)
    .single();

  if (orgError) {
    console.error("[stripe/portal] organization query:", orgError.message);
    return jsonProblem(500, {
      error: "Could not load organization",
      code: "organization_load_failed",
      diagnostic_id: "stripe_portal_organization_load_failed",
      route: ROUTE,
    });
  }

  if (!orgRow) {
    return jsonProblem(400, {
      error: "No organization",
      code: "organization_missing",
      diagnostic_id: "stripe_portal_organization_missing",
      route: ROUTE,
    });
  }
  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) {
    console.error("[stripe/portal] config:", stripeClient.error);
    return stripeDependencyBlocked(
      "stripe_portal_provider_missing",
      "Billing provider is not configured"
    );
  }
  const stripe = stripeClient.stripe;

  const customerId = orgRow.stripe_customer_id;

  if (!customerId) {
    return jsonProblem(400, {
      error: "No billing account",
      code: "billing_account_missing",
      diagnostic_id: "stripe_portal_billing_account_missing",
      route: ROUTE,
    });
  }

  const appUrl = getRequestOrigin(request);

  // SPEC: §3.6 reject non-HTTPS in production
  if (
    process.env.NODE_ENV === "production" &&
    !appUrl.startsWith("https://") &&
    !appUrl.startsWith("http://localhost")
  ) {
    console.error("[stripe/portal] non-HTTPS origin in prod:", appUrl);
    return jsonProblem(500, {
      error: "Invalid return URL",
      code: "invalid_return_url",
      diagnostic_id: "stripe_portal_invalid_return_url",
      route: ROUTE,
    });
  }

  // SPEC: §3.4 — read `?return=` for deep-link flow_data
  const url = new URL(request.url);
  const returnParam = url.searchParams.get("return");
  const flowType = returnParam ? PORTAL_FLOW_MAP[returnParam] : undefined;

  type PortalCreate = Parameters<typeof stripe.billingPortal.sessions.create>[0];
  const sessionParams: PortalCreate = {
    customer: customerId,
    return_url: `${appUrl}/settings/billing`,
  };
  if (flowType) {
    // Stripe billingPortal supports flow_data with `type` discriminator.
    // We cast through unknown because flow_data subtype params differ.
    (sessionParams as unknown as { flow_data: { type: string } }).flow_data = {
      type: flowType,
    };
  }

  let session: Awaited<ReturnType<typeof stripe.billingPortal.sessions.create>>;
  try {
    session = await stripe.billingPortal.sessions.create(sessionParams);
  } catch (err) {
    // SPEC: §15.11 log Stripe error.requestId
    const stripeErr = err as { requestId?: string; code?: string; type?: string; statusCode?: number };
    console.error(
      "[stripe/portal] billingPortal.sessions.create:",
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
          route: "stripe/portal",
          requestId: stripeErr.requestId,
          stripeCode: stripeErr.code,
        },
      });
    }
    return jsonProblem(502, {
      error: "Billing portal could not be opened. Try again or contact support.",
      code: "portal_session_create_failed",
      diagnostic_id: "stripe_portal_session_create_failed",
      route: ROUTE,
    });
  }

  if (!session.url) {
    console.error("[stripe/portal] session missing url", session.id);
    return jsonProblem(500, {
      error: "Portal did not return a URL",
      code: "portal_session_url_missing",
      diagnostic_id: "stripe_portal_session_url_missing",
      route: ROUTE,
    });
  }

  // SPEC: §3.16 + §3.26
  const res = jsonOk({ url: session.url });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}
