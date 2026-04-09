import { createAdminClient } from "@/lib/supabase/server";

export async function enqueueOutboundEvent(input: {
  organizationId: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  schemaVersion?: string;
}) {
  try {
    const admin = await createAdminClient();
    await admin.from("outbound_events").insert({
      organization_id: input.organizationId,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      payload: {
        schema_version: input.schemaVersion ?? "v1",
        emitted_at: new Date().toISOString(),
        ...((input.payload ?? {}) as Record<string, unknown>),
      },
    });
  } catch (err) {
    console.error("[outbound-events] enqueue failed", err);
  }
}
