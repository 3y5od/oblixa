import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { NOTIFICATION_TAXONOMY } from "@/lib/notification-taxonomy";

function modeRank(mode: WorkspaceProductMode): number {
  if (mode === "assurance") return 2;
  if (mode === "advanced") return 1;
  return 0;
}

export const NOTIFICATION_TIER_BY_TYPE = Object.fromEntries(
  NOTIFICATION_TAXONOMY.map((row) => [row.notificationType, row.tier])
) as Record<string, "core" | "advanced" | "assurance">;

/**
 * Maps delivery notification_type strings to product surface tier (V7 §13 taxonomy).
 * Unknown types default to core so operational mail is not accidentally suppressed.
 */
export function notificationTierForType(notificationType: string): "core" | "advanced" | "assurance" {
  const t = notificationType.toLowerCase();
  return NOTIFICATION_TIER_BY_TYPE[t as keyof typeof NOTIFICATION_TIER_BY_TYPE] ?? "core";
}

function tierRank(tier: "core" | "advanced" | "assurance"): number {
  if (tier === "assurance") return 2;
  if (tier === "advanced") return 1;
  return 0;
}

export function workspaceModeAllowsNotificationTier(
  mode: WorkspaceProductMode,
  tier: "core" | "advanced" | "assurance"
): boolean {
  return modeRank(mode) >= tierRank(tier);
}

export function notificationTypesBlockedByMode(mode: WorkspaceProductMode): string[] {
  return Object.entries(NOTIFICATION_TIER_BY_TYPE)
    .filter(([, tier]) => !workspaceModeAllowsNotificationTier(mode, tier))
    .map(([type]) => type);
}
