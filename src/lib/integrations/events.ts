import { createAdminClient } from "@/lib/supabase/server";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { workspaceModeAllowsNotificationTier } from "@/lib/notification-product-tier";
import { outboundEventTierForType } from "@/lib/product-surface/outbound-event-tier";

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
    const v6 = await getV6OrgSettingsJson(admin, input.organizationId);
    const suppressed = Array.isArray(v6.notification_suppressed_event_types)
      ? v6.notification_suppressed_event_types
      : [];
    if (suppressed.includes(input.eventType)) {
      return false;
    }
    const mode = parseWorkspaceMode(v6);
    const tier = outboundEventTierForType(input.eventType);
    if (!workspaceModeAllowsNotificationTier(mode, tier)) {
      return false;
    }
    const { error } = await admin.from("outbound_events").insert({
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
    if (error) {
      throw error;
    }
    return true;
  } catch (err) {
    console.error("[outbound-events] enqueue failed", err);
    return false;
  }
}
