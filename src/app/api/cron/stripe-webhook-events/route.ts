import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authorizeCronRequest } from "@/lib/security/cron-auth";

/** Rows older than this are removed (idempotency records are only needed for Stripe retries). */
const RETENTION_DAYS = 90;

function authorizeCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }
  return authorizeCronRequest(request, cronSecret);
}

/**
 * GET — periodic cleanup of processed Stripe webhook event ids (same auth as /api/reminders/send).
 * Schedule in Vercel Cron or external ping with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET is not set" },
      { status: 500 }
    );
  }

  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count: rowCount, error: countErr } = await admin
    .from("stripe_webhook_events")
    .select("id", { count: "exact", head: true })
    .lt("received_at", cutoff);

  if (countErr) {
    console.error("[cron/stripe-webhook-events] count:", countErr.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const { error: delErr } = await admin
    .from("stripe_webhook_events")
    .delete()
    .lt("received_at", cutoff);

  if (delErr) {
    console.error("[cron/stripe-webhook-events] delete:", delErr.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: rowCount ?? 0,
    retentionDays: RETENTION_DAYS,
    cutoff,
  });
}
