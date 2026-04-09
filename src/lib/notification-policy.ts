import { createAdminClient } from "@/lib/supabase/server";

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
  return evaluateNotificationPolicy(settings?.notification_policy_json, {
    channel: input.channel,
    notificationType: input.notificationType,
  });
}
