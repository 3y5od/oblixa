import { createAdminClient } from "@/lib/supabase/server";

export async function appendCasefileEvent(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  organizationId: string;
  contractId: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  await input.admin.from("operational_casefile_events").insert({
    organization_id: input.organizationId,
    contract_id: input.contractId,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    actor_user_id: input.actorUserId ?? null,
    details_json: input.details ?? {},
    source: "system",
  });
}
