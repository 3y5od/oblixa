import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/env/server";
import { captureServerMessage } from "@/lib/observability/sentry";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";

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
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    pingCronHealthcheck("cron/stripe-webhook-events", {
      ok: false,
      status: 500,
      reason: "cron_secret_missing",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET is not set" },
      { status: 500 }
    );
  }

  if (!authorizeCron(request)) {
    pingCronHealthcheck("cron/stripe-webhook-events", {
      ok: false,
      status: 401,
      reason: "unauthorized",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  try {
    ({ url: supabaseUrl } = getSupabasePublicEnv());
    serviceRoleKey = getSupabaseServiceRoleKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supabase env misconfigured";
    console.error("[cron/stripe-webhook-events] configuration error:", message);
    pingCronHealthcheck("cron/stripe-webhook-events", {
      ok: false,
      status: 500,
      reason: "supabase_env_invalid",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count: rowCount, error: countErr } = await admin
    .from("stripe_webhook_events")
    .select("id", { count: "exact", head: true })
    .lt("received_at", cutoff);

  if (countErr) {
    console.error("[cron/stripe-webhook-events] count:", countErr.message);
    captureServerMessage(countErr.message, {
      level: "error",
      extra: { route: "cron/stripe-webhook-events", phase: "count" },
    });
    pingCronHealthcheck("cron/stripe-webhook-events", {
      ok: false,
      status: 500,
      reason: "count_query_failed",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const { error: delErr } = await admin
    .from("stripe_webhook_events")
    .delete()
    .lt("received_at", cutoff);

  if (delErr) {
    console.error("[cron/stripe-webhook-events] delete:", delErr.message);
    captureServerMessage(delErr.message, {
      level: "error",
      extra: { route: "cron/stripe-webhook-events", phase: "delete" },
    });
    pingCronHealthcheck("cron/stripe-webhook-events", {
      ok: false,
      status: 500,
      reason: "delete_failed",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  const payload = {
    ok: true,
    deleted: rowCount ?? 0,
    retentionDays: RETENTION_DAYS,
    cutoff,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("cron/stripe-webhook-events", payload);
  return NextResponse.json(payload);
}
