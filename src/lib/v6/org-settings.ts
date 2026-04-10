import type { AdminClient } from "@/lib/v6/service";

export type V6OrgSettingsJson = {
  /** When false, autopilot will not perform mutating actions for this org (dry-runs still allowed). */
  autopilot_allow_execution?: boolean;
  /** Optional emails for future review-board digests (stored only until delivery is wired). */
  review_board_notification_emails?: string[];
};

export async function getV6OrgSettingsJson(
  admin: AdminClient,
  orgId: string
): Promise<V6OrgSettingsJson> {
  const { data, error } = await admin
    .from("organizations")
    .select("v6_org_settings_json")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return {};
  const raw = (data as { v6_org_settings_json?: unknown }).v6_org_settings_json;
  if (!raw || typeof raw !== "object") return {};
  return raw as V6OrgSettingsJson;
}

export async function mergeV6OrgSettingsJson(
  admin: AdminClient,
  orgId: string,
  patch: Partial<V6OrgSettingsJson>
): Promise<{ data: V6OrgSettingsJson | null; error: { message: string } | null }> {
  const prev = await getV6OrgSettingsJson(admin, orgId);
  const next: V6OrgSettingsJson = { ...prev, ...patch };
  if (patch.review_board_notification_emails != null) {
    next.review_board_notification_emails = patch.review_board_notification_emails.filter(
      (e) => typeof e === "string" && e.includes("@")
    );
  }
  const { data, error } = await admin
    .from("organizations")
    .update({ v6_org_settings_json: next })
    .eq("id", orgId)
    .select("v6_org_settings_json")
    .maybeSingle();
  if (error) return { data: null, error };
  const raw = (data as { v6_org_settings_json?: unknown } | null)?.v6_org_settings_json;
  return { data: (raw && typeof raw === "object" ? raw : next) as V6OrgSettingsJson, error: null };
}

/** Org may opt out of mutating autopilot even when global env allows execution. */
export async function isOrgAutopilotExecutionAllowed(admin: AdminClient, orgId: string): Promise<boolean> {
  const s = await getV6OrgSettingsJson(admin, orgId);
  if (s.autopilot_allow_execution === false) return false;
  return true;
}
