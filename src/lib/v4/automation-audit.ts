import { createAdminClient } from "@/lib/supabase/server";
import { appendCasefileEvent } from "@/lib/v4/casefile";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export async function recordAutomationEvent(input: {
  admin: AdminClient;
  organizationId: string;
  action: string;
  contractId?: string | null;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  await input.admin.from("audit_events").insert({
    organization_id: input.organizationId,
    contract_id: input.contractId ?? null,
    user_id: null,
    action: `automation.${input.action}`,
    details: input.details ?? {},
  });

  if (input.contractId) {
    await appendCasefileEvent({
      admin: input.admin,
      organizationId: input.organizationId,
      contractId: input.contractId,
      eventType: `automation.${input.action}`,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ?? {},
    });
  }
}
