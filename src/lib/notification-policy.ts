import { createAdminClient } from "@/lib/supabase/server";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import {
  notificationTierForType,
  workspaceModeAllowsNotificationTier,
} from "@/lib/notification-product-tier";
import { NOTIFICATION_TAXONOMY_BY_TYPE } from "@/lib/notification-taxonomy";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type Channel = "email" | "slack";

function isWithinQuietHours(now: Date, start: number, end: number): boolean {
  const hour = now.getUTCHours();
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function evaluateNotificationPolicy(
  notificationPolicyJson: unknown,
  input: { channel: Channel; notificationType: string }
): boolean {
  const policy = (notificationPolicyJson ?? {}) as Record<string, unknown>;
  const channelPolicy = (policy[input.channel] ?? {}) as Record<string, unknown>;
  if (channelPolicy.enabled === false) return false;

  const blockedTypes = Array.isArray(channelPolicy.blocked_types)
    ? (channelPolicy.blocked_types as unknown[]).map((v) => String(v))
    : [];
  if (blockedTypes.includes(input.notificationType)) return false;

  const quietStart = Number(channelPolicy.quiet_hours_start_utc ?? NaN);
  const quietEnd = Number(channelPolicy.quiet_hours_end_utc ?? NaN);
  if (
    Number.isFinite(quietStart) &&
    Number.isFinite(quietEnd) &&
    quietStart >= 0 &&
    quietStart <= 23 &&
    quietEnd >= 0 &&
    quietEnd <= 23 &&
    isWithinQuietHours(new Date(), quietStart, quietEnd)
  ) {
    return false;
  }
  return true;
}

export async function loadNotificationPoliciesForOrganizations(
  admin: AdminClient,
  organizationIds: string[]
): Promise<Map<string, unknown>> {
  const unique = [...new Set(organizationIds)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data } = await admin
    .from("organization_workflow_settings")
    .select("organization_id, notification_policy_json")
    .in("organization_id", unique);
  const map = new Map<string, unknown>();
  for (const row of data ?? []) {
    const id = row.organization_id as string;
    if (id) map.set(id, row.notification_policy_json);
  }
  return map;
}

export async function isNotificationAllowed(
  admin: AdminClient,
  input: { organizationId: string; channel: Channel; notificationType: string }
): Promise<boolean> {
  const { data: settings } = await admin
    .from("organization_workflow_settings")
    .select("notification_policy_json")
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const policyOk = evaluateNotificationPolicy(settings?.notification_policy_json, {
    channel: input.channel,
    notificationType: input.notificationType,
  });
  if (!policyOk) return false;

  return isNotificationTypeAllowedForWorkspace(admin, {
    organizationId: input.organizationId,
    notificationType: input.notificationType,
  });
}

export async function isNotificationTypeAllowedForWorkspace(
  admin: AdminClient,
  input: { organizationId: string; notificationType: string }
): Promise<boolean> {
  const v6 = await getV6OrgSettingsJson(admin, input.organizationId);
  const mode = parseWorkspaceMode(v6);
  const tier = notificationTierForType(input.notificationType);
  if (!workspaceModeAllowsNotificationTier(mode, tier)) return false;

  const row = NOTIFICATION_TAXONOMY_BY_TYPE.get(input.notificationType.toLowerCase());
  if (!row) return true;
  if (row.featureFamily === "decisions" && (v6.advanced_modules_hidden ?? []).includes("decisions")) return false;
  if (row.featureFamily === "campaigns" && (v6.advanced_modules_hidden ?? []).includes("campaigns")) return false;
  if (row.featureFamily === "programs" && (v6.advanced_modules_hidden ?? []).includes("programs")) return false;
  if (
    row.featureFamily === "relationship_workspaces" &&
    (v6.advanced_modules_hidden ?? []).includes("relationships")
  ) {
    return false;
  }
  if (row.featureFamily === "findings" && (v6.assurance_modules_hidden ?? []).includes("findings")) return false;
  if (
    row.featureFamily === "control_policies" &&
    (v6.assurance_modules_hidden ?? []).includes("control_policies")
  ) {
    return false;
  }
  if (row.featureFamily === "scorecards" && (v6.assurance_modules_hidden ?? []).includes("scorecards")) return false;
  if (row.featureFamily === "playbooks" && (v6.assurance_modules_hidden ?? []).includes("playbooks")) return false;
  if (row.featureFamily === "autopilot" && (v6.assurance_modules_hidden ?? []).includes("autopilot")) return false;
  if (
    row.featureFamily === "review_boards" &&
    (v6.assurance_modules_hidden ?? []).includes("review_boards")
  ) {
    return false;
  }
  if (
    row.featureFamily === "outcome_intelligence" &&
    (v6.assurance_modules_hidden ?? []).includes("outcome_intelligence")
  ) {
    return false;
  }
  return true;
}
