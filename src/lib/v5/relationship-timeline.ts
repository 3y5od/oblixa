import type { createAdminClient } from "@/lib/supabase/server";
import {
  ensureAccountWorkspaceFromContracts,
  ensureCounterpartyWorkspaceFromContracts,
  ensureTimelineForAccount,
  ensureTimelineForCounterparty,
} from "@/lib/v5/relationship-bootstrap";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export async function appendAccountTimelineEvent(
  admin: Admin,
  organizationId: string,
  accountKey: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const w = await ensureAccountWorkspaceFromContracts(admin, organizationId, accountKey);
  if (!w) return;
  const timelineId = await ensureTimelineForAccount(
    admin,
    organizationId,
    w.id,
    `Timeline · ${w.display_name}`
  );
  if (!timelineId) return;
  await admin.from("relationship_timeline_events").insert({
    organization_id: organizationId,
    relationship_timeline_id: timelineId,
    event_type: eventType,
    payload_json: { ...payload, recorded_at: new Date().toISOString() },
  });
}

export async function appendCounterpartyTimelineEvent(
  admin: Admin,
  organizationId: string,
  counterpartyKey: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const w = await ensureCounterpartyWorkspaceFromContracts(admin, organizationId, counterpartyKey);
  if (!w) return;
  const timelineId = await ensureTimelineForCounterparty(
    admin,
    organizationId,
    w.id,
    `Timeline · ${w.display_name}`
  );
  if (!timelineId) return;
  await admin.from("relationship_timeline_events").insert({
    organization_id: organizationId,
    relationship_timeline_id: timelineId,
    event_type: eventType,
    payload_json: { ...payload, recorded_at: new Date().toISOString() },
  });
}

/** Append only when payload_json differs from the latest event of the same type (idempotent cron). */
export async function appendTimelineEventDeduped(
  admin: Admin,
  organizationId: string,
  timelineId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const snap = JSON.stringify(payload);
  const { data: last } = await admin
    .from("relationship_timeline_events")
    .select("payload_json")
    .eq("organization_id", organizationId)
    .eq("relationship_timeline_id", timelineId)
    .eq("event_type", eventType)
    .order("event_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.payload_json) {
    const storedPayload = {
      ...(last.payload_json as Record<string, unknown>),
    };
    delete storedPayload.recorded_at;
    if (JSON.stringify(storedPayload) === snap) return;
  }
  await admin.from("relationship_timeline_events").insert({
    organization_id: organizationId,
    relationship_timeline_id: timelineId,
    event_type: eventType,
    payload_json: { ...payload, recorded_at: new Date().toISOString() },
  });
}
