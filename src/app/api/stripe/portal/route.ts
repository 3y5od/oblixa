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
import { enforceIdempotency } from "@/lib/idempotency";

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
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  if (membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`stripe-portal:${user.id}:${ip}`, RATE_LIMITS.stripePortalSession);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const duplicate = await enforceIdempotency(request, {
    scope: "stripe.portal",
    actorKey: `${membership.organization_id}:${user.id}`,
  });
  if (duplicate) return duplicate;

  const { data: orgRow, error: orgError } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", membership.organization_id)
    .single();

  if (orgError) {
    console.error("[stripe/portal] organization query:", orgError.message);
    return NextResponse.json({ error: "Could not load organization" }, { status: 500 });
  }

  if (!orgRow) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }
  const stripeClient = await getStripeClient();
  if (!stripeClient.ok) {
    console.error("[stripe/portal] config:", stripeClient.error);
    return NextResponse.json({ error: "Billing is not configured" }, { status: 500 });
  }
  const stripe = stripeClient.stripe;

  const customerId = orgRow.stripe_customer_id;

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
