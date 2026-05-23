"use server";

import { revalidatePath } from "next/cache";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/notifications-page-v3-pass.md — V3 server-action
// hardening on top of V1/V2. Changes:
//   T8.6 — admin OR owner role gate (V1 only allowed admin)
//   T8.8 — audit log captures actor role at time-of-action
//   T16.6 — overnight quiet-range (start > end) is valid (modular)
//   T19.2 — slack policy preservation re-audited
//   T19.3 — unknown blocked_types preserved (forward-compat with
//           categories that exist server-side before UI ships them)
//   T20.1 — audit payload includes diff of changed keys
//   T20.2 — event taxonomy: settings.notifications_updated
//   T20.3 — source: "web" tagging

const CORE_NOTIFICATION_TYPES = SETTINGS_NOTIFICATIONS_STRINGS.categories.map(
  (category) => category.key
);

type CoreNotificationType = (typeof CORE_NOTIFICATION_TYPES)[number];

function isCoreNotificationType(value: string): value is CoreNotificationType {
  return (CORE_NOTIFICATION_TYPES as readonly string[]).includes(value);
}

function parseHour(formData: FormData, name: string): number {
  const raw = formData.get(name);
  const parsed = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(23, Math.max(0, Math.trunc(parsed)));
}

type PreservedSlack = {
  enabled?: unknown;
  quiet_hours_start_utc?: unknown;
  quiet_hours_end_utc?: unknown;
  blocked_types?: unknown;
};

function preserveSlackPolicy(value: unknown): PreservedSlack | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const policy = value as { slack?: unknown };
  if (!policy.slack || typeof policy.slack !== "object" || Array.isArray(policy.slack)) {
    return undefined;
  }
  return policy.slack as PreservedSlack;
}

// V3 T19.3 — preserve unknown blocked_types entries (forward-compat
// with categories that exist server-side before the UI ships them).
function preserveUnknownBlockedTypes(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const policy = value as { email?: { blocked_types?: unknown } };
  const blocked = policy.email?.blocked_types;
  if (!Array.isArray(blocked)) return [];
  return blocked
    .filter((v): v is string => typeof v === "string")
    .filter((key) => !isCoreNotificationType(key));
}

// V3 T19.1 — defensive snapshot of the existing policy for diff-logging.
function snapshotEmail(value: unknown): {
  enabled: boolean;
  quietStart: number;
  quietEnd: number;
  blocked: string[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { enabled: true, quietStart: 0, quietEnd: 0, blocked: [] };
  }
  const policy = value as { email?: PreservedSlack };
  const email = policy.email ?? {};
  const parsed = (raw: unknown) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.min(23, Math.max(0, Math.trunc(n)));
  };
  return {
    enabled: email.enabled !== false,
    quietStart: parsed(email.quiet_hours_start_utc),
    quietEnd: parsed(email.quiet_hours_end_utc),
    blocked: Array.isArray(email.blocked_types)
      ? email.blocked_types.filter((v): v is string => typeof v === "string")
      : [],
  };
}

export type UpsertNotificationSettingsResult =
  | { success: true }
  | { error: string };

export async function upsertNotificationSettingsForm(
  formData: FormData
): Promise<UpsertNotificationSettingsResult> {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { error: "Not authenticated" };

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "No workspace membership" };
  // V3 T8.6 — admin OR owner can update notification settings
  // (V1 was admin-only; owner role added for parity with other
  // workspace-policy mutations).
  const actorRole = typeof membership.role === "string" ? membership.role : "";
  if (actorRole !== "admin" && actorRole !== "owner") {
    return { error: "Access denied" };
  }

  const orgId = membership.organization_id as string;
  const emailEnabled = formData.has("emailEnabled");
  const quietStart = parseHour(formData, "emailQuietStartUtc");
  const quietEnd = parseHour(formData, "emailQuietEndUtc");

  const selectedCategories = new Set(
    formData
      .getAll("notificationCategories")
      .filter((value): value is CoreNotificationType =>
        typeof value === "string" && isCoreNotificationType(value)
      )
  );

  // Read existing policy to (a) preserve Slack channel, (b) preserve
  // unknown blocked_types entries, and (c) compute the diff payload.
  const { data: existing } = await admin
    .from("organization_workflow_settings")
    .select("notification_policy_json")
    .eq("organization_id", orgId)
    .maybeSingle();

  const preservedSlack = preserveSlackPolicy(existing?.notification_policy_json);
  const preservedUnknownBlocked = preserveUnknownBlockedTypes(
    existing?.notification_policy_json
  );
  const before = snapshotEmail(existing?.notification_policy_json);

  const knownBlocked = CORE_NOTIFICATION_TYPES.filter(
    (type) => !selectedCategories.has(type)
  );
  // V3 T19.3 — merge known + preserved-unknown blocked types.
  const blockedTypes = Array.from(
    new Set<string>([...knownBlocked, ...preservedUnknownBlocked])
  );

  const notificationPolicy = {
    email: {
      enabled: emailEnabled,
      quiet_hours_start_utc: quietStart,
      quiet_hours_end_utc: quietEnd,
      blocked_types: blockedTypes,
    },
    ...(preservedSlack ? { slack: preservedSlack } : {}),
  };

  // V3 T20.x — structured event log with diff payload, actor role,
  // source tag, idempotency key. Mirrors audit-event taxonomy
  // (`settings.notifications_updated`) for downstream log analysis.
  const idempotencyKey = formData.get("idempotency_key");
  const after = {
    enabled: emailEnabled,
    quietStart,
    quietEnd,
    blocked: blockedTypes,
  };
  const diff = {
    enabled: before.enabled !== after.enabled
      ? { before: before.enabled, after: after.enabled }
      : undefined,
    quietStart: before.quietStart !== after.quietStart
      ? { before: before.quietStart, after: after.quietStart }
      : undefined,
    quietEnd: before.quietEnd !== after.quietEnd
      ? { before: before.quietEnd, after: after.quietEnd }
      : undefined,
    blocked: JSON.stringify(before.blocked.slice().sort()) !==
      JSON.stringify(after.blocked.slice().sort())
      ? { before: before.blocked, after: after.blocked }
      : undefined,
  };
  console.info("[audit] settings.notifications_updated", {
    event: "settings.notifications_updated",
    source: "web",
    orgId,
    actorId: user.id,
    actorRole,
    idempotencyKey:
      typeof idempotencyKey === "string" && idempotencyKey.length > 0
        ? idempotencyKey.slice(0, 64)
        : undefined,
    diff,
  });

  const { error } = await admin
    .from("organization_workflow_settings")
    .upsert(
      {
        organization_id: orgId,
        notification_policy_json: notificationPolicy,
      },
      { onConflict: "organization_id" }
    );

  if (error) return { error: mapDataSourceError(error.message) };

  revalidatePath("/settings/operations");
  revalidatePath("/settings/notifications");
  revalidatePath("/settings");
  return { success: true };
}
