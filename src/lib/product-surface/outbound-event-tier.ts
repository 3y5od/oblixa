import type { NotificationProductTier } from "@/lib/product-surface/types";
import { notificationTierForType } from "@/lib/notification-product-tier";

/**
 * Tier for `outbound_events.event_type` (product-surface policy §18).
 * Unknown types default to core so operational telemetry is not dropped by mode gates.
 */
const OUTBOUND_EVENT_TYPE_TIER: Record<string, NotificationProductTier> = {
  // Advanced / portfolio
  "program.applied": "advanced",
  "program.auto_attached": "advanced",
  "report.queued_by_rule": "advanced",
  "automation.notification": "advanced",
  "renewal.decision_packet_generated": "advanced",
  "renewal.recommendation_updated": "advanced",
};

export function outboundEventTierForType(eventType: string): NotificationProductTier {
  const mapped = OUTBOUND_EVENT_TYPE_TIER[eventType];
  if (mapped) return mapped;
  const slug = eventType.replace(/\./g, "_");
  return notificationTierForType(slug);
}
