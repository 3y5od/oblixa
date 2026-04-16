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
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const dedupQuery = input.admin
    .from("operational_casefile_events")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", input.contractId)
    .eq("event_type", input.eventType)
    .gte("created_at", cutoff);

  const { count } = input.entityId
    ? await dedupQuery.eq("entity_id", input.entityId)
    : await dedupQuery.is("entity_id", null);

  if ((count ?? 0) > 0) return;

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
