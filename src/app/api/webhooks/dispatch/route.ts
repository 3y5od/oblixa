import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCronRequest } from "@/lib/security/cron-auth";
import { safeFetch } from "@/lib/security/safe-fetch";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { pingCronHealthcheck } from "@/lib/observability/cron-healthcheck";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/security/token-crypto";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { appendCasefileEvent } from "@/lib/v4/casefile";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FAILURES_REPORTED = 200;

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return hex(sig);
}

async function processWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const safeLimit = Math.max(1, Math.floor(limit));
  let idx = 0;
  async function run(): Promise<void> {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(safeLimit, items.length) }, () => run()));
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    pingCronHealthcheck("webhooks/dispatch", {
      ok: false,
      status: 500,
      reason: "cron_secret_missing",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }
  if (!authorizeCronRequest(request, cronSecret)) {
    pingCronHealthcheck("webhooks/dispatch", {
      ok: false,
      status: 401,
      reason: "unauthorized",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cronRate = await rateLimitCheck("cron:webhooks:dispatch", RATE_LIMITS.webhooksDispatchCron);
  if (!cronRate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterMs: cronRate.retryAfterMs },
      { status: 429 }
    );
  }

  const admin = await createAdminClient();
  const url = new URL(request.url);
  const diagnosticsEventId = url.searchParams.get("eventId")?.trim();
  if (diagnosticsEventId) {
    const [{ data: event }, { data: deliveries }] = await Promise.all([
      admin
        .from("outbound_events")
        .select("id, organization_id, event_type, entity_type, entity_id, created_at, delivered, delivered_at")
        .eq("id", diagnosticsEventId)
        .maybeSingle(),
      admin
        .from("outbound_event_deliveries")
        .select("id, subscription_id, delivered, delivered_at, attempt_count, last_error, next_attempt_at")
        .eq("outbound_event_id", diagnosticsEventId)
        .order("attempt_count", { ascending: false }),
    ]);
    return NextResponse.json({ diagnostics: { event, deliveries: deliveries ?? [] }, ok: true });
  }
  const { data: events } = await admin
    .from("outbound_events")
    .select("id, organization_id, event_type, entity_type, entity_id, payload, created_at")
    .eq("delivered", false)
    .order("created_at", { ascending: true })
    .limit(50);

  let delivered = 0;
  let attempts = 0;
  let totalFailures = 0;
  const failures: string[] = [];
  const attemptStatusCounts: Record<string, number> = {};
  const nowIso = new Date().toISOString();
  const orgIds = Array.from(new Set((events ?? []).map((event) => event.organization_id)));
  const { data: subscriptions } =
    orgIds.length === 0
      ? { data: [] as Array<{ id: string; organization_id: string; url: string; secret: string; events: string[] | null }> }
      : await admin
          .from("webhook_subscriptions")
          .select("id, organization_id, url, secret, events")
          .in("organization_id", orgIds)
          .eq("active", true);
  const subscriptionsByOrg = new Map<string, Array<{ id: string; url: string; secret: string; events: string[] | null }>>();
  for (const sub of subscriptions ?? []) {
    const group = subscriptionsByOrg.get(sub.organization_id);
    if (group) {
      group.push({ id: sub.id, url: sub.url, secret: sub.secret, events: sub.events });
    } else {
      subscriptionsByOrg.set(sub.organization_id, [
        { id: sub.id, url: sub.url, secret: sub.secret, events: sub.events },
      ]);
    }
  }

  for (const event of events ?? []) {
    const eligibleSubs = (subscriptionsByOrg.get(event.organization_id) ?? []).filter((sub) => {
      const acceptedEvents = (sub.events ?? []) as string[];
      return acceptedEvents.length === 0 || acceptedEvents.includes(event.event_type);
    });

    if (eligibleSubs.length === 0) {
      await admin
        .from("outbound_events")
        .update({ delivered: true, delivered_at: nowIso })
        .eq("id", event.id);
      delivered++;
      continue;
    }

    await admin.from("outbound_event_deliveries").upsert(
      eligibleSubs.map((sub) => ({
        outbound_event_id: event.id,
        organization_id: event.organization_id,
        subscription_id: sub.id,
      })),
      { onConflict: "outbound_event_id,subscription_id", ignoreDuplicates: true }
    );

    const { data: deliveryRows } = await admin
      .from("outbound_event_deliveries")
      .select("id, subscription_id, attempt_count, delivered, next_attempt_at")
      .eq("outbound_event_id", event.id)
      .eq("delivered", false)
      .lte("next_attempt_at", nowIso);

    const subById = new Map(eligibleSubs.map((sub) => [sub.id, sub]));
    const payload = JSON.stringify({
      id: event.id,
      type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      occurred_at: event.created_at,
      schema_version: (event.payload as Record<string, unknown> | null)?.schema_version ?? "v1",
      data: event.payload ?? {},
    });
    type DeliveryPatch = {
      id: string;
      delivered?: boolean;
      delivered_at?: string | null;
      last_attempt_at: string;
      last_error: string | null;
      attempt_count: number;
      next_attempt_at?: string;
    };
    const patches: DeliveryPatch[] = [];
    await processWithConcurrency(deliveryRows ?? [], 6, async (delivery) => {
      const sub = subById.get(delivery.subscription_id);
      if (!sub) return;
      attempts++;
      let signingSecret = sub.secret;
      try {
        signingSecret = decryptIntegrationToken(sub.secret) ?? sub.secret;
      } catch {
        signingSecret = sub.secret;
      }
      // Lazy backfill of legacy plaintext secrets to encrypted form.
      if (!String(sub.secret).startsWith("enc:v1:")) {
        try {
          const reencrypted = encryptIntegrationToken(signingSecret);
          if (reencrypted) {
            await admin
              .from("webhook_subscriptions")
              .update({ secret: reencrypted })
              .eq("id", sub.id);
          }
        } catch {
          // Ignore backfill failures; delivery should still proceed.
        }
      }
      const signature = await signPayload(signingSecret, payload);
      const attemptIso = new Date().toISOString();
      const nextAttemptMinutes = Math.min(
        360,
        Math.max(1, 2 ** Math.min(8, delivery.attempt_count))
      );
      const nextAttemptAt = new Date(
        Date.now() + nextAttemptMinutes * 60 * 1000
      ).toISOString();
      try {
        const url = validateOutboundHttpUrl(sub.url);
        if (!url) {
          totalFailures++;
          if (failures.length < MAX_FAILURES_REPORTED) {
            failures.push(`${event.id}:${sub.id}:invalid_url`);
          }
          patches.push({
            id: delivery.id,
            last_attempt_at: attemptIso,
            last_error: "invalid_url",
            attempt_count: delivery.attempt_count + 1,
            next_attempt_at: nextAttemptAt,
          });
          return;
        }
        const attemptStartedAt = Date.now();
        const res = await safeFetch(url.toString(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-oblixa-signature": signature,
            "x-oblixa-event": event.event_type,
            "x-oblixa-schema-version": String(
              (event.payload as Record<string, unknown> | null)?.schema_version ?? "v1"
            ),
          },
          body: payload,
        });
        if (res.ok) {
          attemptStatusCounts[String(res.status)] = (attemptStatusCounts[String(res.status)] ?? 0) + 1;
          patches.push({
            id: delivery.id,
            delivered: true,
            delivered_at: attemptIso,
            last_attempt_at: attemptIso,
            last_error: null,
            attempt_count: delivery.attempt_count + 1,
          });
        } else {
          const attemptDurationMs = Date.now() - attemptStartedAt;
          attemptStatusCounts[String(res.status)] = (attemptStatusCounts[String(res.status)] ?? 0) + 1;
          totalFailures++;
          if (failures.length < MAX_FAILURES_REPORTED) {
            failures.push(`${event.id}:${sub.id}:${res.status}`);
          }
          patches.push({
            id: delivery.id,
            last_attempt_at: attemptIso,
            last_error: `HTTP ${res.status}:${attemptDurationMs}ms`,
            attempt_count: delivery.attempt_count + 1,
            next_attempt_at: nextAttemptAt,
          });
        }
      } catch {
        attemptStatusCounts.network = (attemptStatusCounts.network ?? 0) + 1;
        totalFailures++;
        if (failures.length < MAX_FAILURES_REPORTED) {
          failures.push(`${event.id}:${sub.id}:network`);
        }
        patches.push({
          id: delivery.id,
          last_attempt_at: attemptIso,
          last_error: "network",
          attempt_count: delivery.attempt_count + 1,
          next_attempt_at: nextAttemptAt,
        });
      }
    });
    if (patches.length > 0) {
      for (let i = 0; i < patches.length; i += 200) {
        const chunk = patches.slice(i, i + 200);
        await admin
          .from("outbound_event_deliveries")
          .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
      }
    }
    const { count: remainingCount } = await admin
      .from("outbound_event_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("outbound_event_id", event.id)
      .eq("delivered", false);
    if ((remainingCount ?? 0) === 0) {
      delivered++;
      await admin
        .from("outbound_events")
        .update({ delivered: true, delivered_at: new Date().toISOString() })
        .eq("id", event.id);
      const p = event.payload as Record<string, unknown> | null;
      const contractId =
        (typeof p?.contract_id === "string" ? p.contract_id : null) ||
        (event.entity_type === "contract" && event.entity_id ? String(event.entity_id) : null);
      if (contractId) {
        await appendCasefileEvent({
          admin,
          organizationId: event.organization_id,
          contractId,
          eventType: "webhook.delivered",
          entityType: "outbound_event",
          entityId: event.id,
          details: { event_type: event.event_type },
        });
      }
    }
  }

  const responsePayload = {
    candidates: events?.length ?? 0,
    delivered,
    attempts,
    failures,
    failuresTruncated: totalFailures > failures.length,
    totalFailures,
    attemptStatusCounts,
    durationMs: Date.now() - startedAt,
  };
  pingCronHealthcheck("webhooks/dispatch", {
    ok: totalFailures === 0,
    ...responsePayload,
  });
  return NextResponse.json(responsePayload);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || !authorizeCronRequest(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await createAdminClient();
  const body = (await request.json().catch(() => ({}))) as {
    action?: "replay_event";
    eventId?: string;
  };
  if (body.action !== "replay_event") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
  const eventId = String(body.eventId ?? "").trim();
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  await admin
    .from("outbound_events")
    .update({ delivered: false, delivered_at: null })
    .eq("id", eventId);
  await admin
    .from("outbound_event_deliveries")
    .update({ delivered: false, delivered_at: null, next_attempt_at: new Date().toISOString() })
    .eq("outbound_event_id", eventId);
  return NextResponse.json({ ok: true, replayQueued: true, eventId });
}
