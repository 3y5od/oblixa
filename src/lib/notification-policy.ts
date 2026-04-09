import { createAdminClient } from "@/lib/supabase/server";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type Channel = "email" | "slack";

function isWithinQuietHours(now: Date, start: number, end: number): boolean {
  const hour = now.getUTCHours();
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
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
  const policy = (settings?.notification_policy_json ?? {}) as Record<string, unknown>;
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
