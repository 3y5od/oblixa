import { withCronRoute } from "@/lib/cron/route-runner";
import { createAdminClient } from "@/lib/supabase/server";
import { captureServerMessage } from "@/lib/observability/sentry";
import { RATE_LIMITS } from "@/lib/rate-limit";

/** Rows older than this are removed (idempotency records are only needed for Stripe retries). */
const RETENTION_DAYS = 90;
const DELETE_BATCH_SIZE = 500;
const MAX_DELETE_ROWS_PER_RUN = 5_000;

/**
 * GET — periodic cleanup of processed Stripe webhook event ids (same auth as /api/reminders/send).
 * Schedule in Vercel Cron or external ping with Authorization: Bearer CRON_SECRET.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withCronRoute({
  route: "/api/cron/stripe-webhook-events",
  healthcheckRoute: "cron/stripe-webhook-events",
  rateLimitKey: "cron:stripe-webhook-events",
  rateLimit: RATE_LIMITS.stripeWebhook,
  adminFactory: createAdminClient,
  handler: async ({ admin }) => {
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
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        pingReason: "count_query_failed",
        body: { error: "Query failed" },
      };
    }

    let deleted = 0;
    while (deleted < MAX_DELETE_ROWS_PER_RUN) {
      const remainingBudget = MAX_DELETE_ROWS_PER_RUN - deleted;
      const batchLimit = Math.min(DELETE_BATCH_SIZE, remainingBudget);
      const { data: ids, error: idErr } = await admin
        .from("stripe_webhook_events")
        .select("id")
        .lt("received_at", cutoff)
        .order("received_at", { ascending: true })
        .limit(batchLimit);
      if (idErr) {
        console.error("[cron/stripe-webhook-events] select ids:", idErr.message);
        captureServerMessage(idErr.message, {
          level: "error",
          extra: { route: "cron/stripe-webhook-events", phase: "select_ids" },
        });
        return {
          status: 500,
          ok: false,
          errorsCount: 1,
          pingReason: "select_ids_failed",
          body: { error: "Query failed" },
        };
      }
      const selectedIds = (ids ?? []).map((row) => row.id).filter(Boolean);
      if (selectedIds.length === 0) break;
      const { error: delErr } = await admin
        .from("stripe_webhook_events")
        .delete()
        .in("id", selectedIds);
      if (delErr) {
        console.error("[cron/stripe-webhook-events] delete:", delErr.message);
        captureServerMessage(delErr.message, {
          level: "error",
          extra: { route: "cron/stripe-webhook-events", phase: "delete" },
        });
        return {
          status: 500,
          ok: false,
          errorsCount: 1,
          pingReason: "delete_failed",
          body: { error: "Delete failed" },
        };
      }
      deleted += selectedIds.length;
      if (selectedIds.length < batchLimit) break;
    }

    return {
      body: {
        deleted,
        eligible: rowCount ?? 0,
        truncated: deleted >= MAX_DELETE_ROWS_PER_RUN && (rowCount ?? 0) > deleted,
        retentionDays: RETENTION_DAYS,
        cutoff,
      },
    };
  },
});
