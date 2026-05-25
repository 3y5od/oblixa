import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";
import { withCronRoute } from "@/lib/cron/route-runner";
import { claimDueRow } from "@/lib/cron/claim-due-row";
import { BODY_LIMIT_STRICT_INBOUND, readJsonBodyLimited } from "@/lib/security/read-json-body-limited";
import { createAdminClient } from "@/lib/supabase/server";
import { gateCronRequest } from "@/lib/security/cron-route-gate";
import { safeFetch } from "@/lib/security/safe-fetch";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";
import { decryptIntegrationToken, encryptIntegrationToken } from "@/lib/security/token-crypto";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isKillWebhookDispatch, killSwitchJsonResponse } from "@/lib/security/kill-switches";
import { appendCasefileEvent } from "@/lib/contract-operations/casefile";
import { scrubOutboundPayloadValue } from "@/lib/messaging/outbound-payload-scrub";
import { enforceIdempotency } from "@/lib/idempotency";
import { recordApiMutationAuditEvent } from "@/lib/security/api-mutation-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FAILURES_REPORTED = 200;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const ROUTE = "/api/webhooks/dispatch";

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

export const GET = withCronRoute({
  route: "/api/webhooks/dispatch",
  healthcheckRoute: "webhooks/dispatch",
  rateLimitKey: "cron:webhooks:dispatch",
  rateLimit: RATE_LIMITS.webhooksDispatchCron,
  preflight: () => (isKillWebhookDispatch() ? killSwitchJsonResponse("webhook_dispatch") : null),
  handler: async ({ admin, request }) => {
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
      return {
        body: {
          diagnostics: { event, deliveries: deliveries ?? [] },
        },
      };
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
    const safeEventPayload = scrubOutboundPayloadValue(event.payload ?? {}, {
      maxDepth: 8,
      maxArrayLength: 100,
      maxKeys: 100,
      maxStringLength: 4000,
    }) as Record<string, unknown>;
    const schemaVersion = String(safeEventPayload.schema_version ?? "v1");
    const payload = JSON.stringify({
      id: event.id,
      type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      occurred_at: event.created_at,
      schema_version: schemaVersion,
      data: safeEventPayload,
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

      const leaseUntilIso = new Date(Date.now() + DELIVERY_LEASE_MS).toISOString();
      const claimResult = await claimDueRow<{
        id: string;
        subscription_id: string;
        attempt_count: number;
        delivered: boolean;
        next_attempt_at: string;
      }>({
        admin,
        table: "outbound_event_deliveries",
        rowId: delivery.id,
        claimPatch: { next_attempt_at: leaseUntilIso },
        filters: [
          { type: "eq", column: "delivered", value: false },
          { type: "lte", column: "next_attempt_at", value: nowIso },
        ],
        select: "id, subscription_id, attempt_count, delivered, next_attempt_at",
      });
      if (claimResult.error) {
        attemptStatusCounts.claim_failed = (attemptStatusCounts.claim_failed ?? 0) + 1;
        totalFailures++;
        if (failures.length < MAX_FAILURES_REPORTED) {
          failures.push(`${event.id}:${delivery.id}:claim_failed`);
        }
        return;
      }
      const claimedDelivery = claimResult.data;
      if (!claimedDelivery) return;

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
        Math.max(1, 2 ** Math.min(8, claimedDelivery.attempt_count))
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
            id: claimedDelivery.id,
            last_attempt_at: attemptIso,
            last_error: "invalid_url",
            attempt_count: claimedDelivery.attempt_count + 1,
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
            "x-oblixa-schema-version": schemaVersion,
          },
          body: payload,
        });
        if (res.ok) {
          attemptStatusCounts[String(res.status)] = (attemptStatusCounts[String(res.status)] ?? 0) + 1;
          patches.push({
            id: claimedDelivery.id,
            delivered: true,
            delivered_at: attemptIso,
            last_attempt_at: attemptIso,
            last_error: null,
            attempt_count: claimedDelivery.attempt_count + 1,
          });
        } else {
          const attemptDurationMs = Date.now() - attemptStartedAt;
          attemptStatusCounts[String(res.status)] = (attemptStatusCounts[String(res.status)] ?? 0) + 1;
          totalFailures++;
          if (failures.length < MAX_FAILURES_REPORTED) {
            failures.push(`${event.id}:${sub.id}:${res.status}`);
          }
          patches.push({
            id: claimedDelivery.id,
            last_attempt_at: attemptIso,
            last_error: `HTTP ${res.status}:${attemptDurationMs}ms`,
            attempt_count: claimedDelivery.attempt_count + 1,
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
          id: claimedDelivery.id,
          last_attempt_at: attemptIso,
          last_error: "network",
          attempt_count: claimedDelivery.attempt_count + 1,
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

    return {
      ok: totalFailures === 0,
      partial: totalFailures > 0,
      errorsCount: totalFailures,
      body: {
        candidates: events?.length ?? 0,
        delivered,
        attempts,
        failures,
        failuresTruncated: totalFailures > failures.length,
        totalFailures,
        attemptStatusCounts,
      },
    };
  },
});

export async function POST(request: Request) {
  const deny = gateCronRequest(request);
  if (deny) return deny;
  const admin = await createAdminClient();

  const duplicate = await enforceIdempotency(request, {
    scope: "api.webhooks.dispatch",
    actorKey: "cron",
  });
  if (duplicate) return duplicate;
  const _lb_body = await readJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND);
  if (!_lb_body.ok) return _lb_body.response;
  const body = (_lb_body.body ?? {}) as {
    action?: "replay_event";
    eventId?: string;
  };
  if (body.action !== "replay_event") {
    return jsonProblem(400, {
      error: "Unsupported action",
      code: "unsupported_action",
      diagnostic_id: "webhook_dispatch_unsupported_action",
      route: ROUTE,
    });
  }
  const eventId = String(body.eventId ?? "").trim();
  if (!eventId) {
    return jsonProblem(400, {
      error: "eventId is required",
      code: "event_id_required",
      diagnostic_id: "webhook_dispatch_event_id_required",
      route: ROUTE,
    });
  }

  const { data: eventRow } = await admin
    .from("outbound_events")
    .select("organization_id")
    .eq("id", eventId)
    .maybeSingle();
  if (eventRow?.organization_id) {
    void recordApiMutationAuditEvent(admin, {
      organizationId: String(eventRow.organization_id),
      actorUserId: null,
      actorType: "system",
      route: ROUTE,
      method: "POST",
    }).catch(() => undefined);
  }

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
