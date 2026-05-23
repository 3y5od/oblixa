import type { SupabaseClient } from "@supabase/supabase-js";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import type { AdminClient } from "@/lib/v6/service";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import {
  isOnboardingBlockingForAdmin,
  parseOnboardingCalibration,
} from "@/lib/onboarding/calibration-types";

export function isOnboardingCalibrationGateDisabled(): boolean {
  const v = process.env.DISABLE_ONBOARDING_CALIBRATION_GATE;
  return v === "true" || v === "1";
}

const CALIBRATION_PATH = "/onboarding/calibration";

/**
 * Admin + org JSON indicates first-run blocking questionnaire (onboarding spec §4).
 */
export async function resolveBlockingCalibrationPathForAdminOrg(input: {
  admin: AdminClient;
  userId: string;
  orgId: string | null;
}): Promise<string | null> {
  if (isOnboardingCalibrationGateDisabled()) return null;
  const { admin, userId, orgId } = input;
  if (!orgId) return null;
  const gateRl = await rateLimitCheck(
    `onboarding-calibration:gate-admin:${userId}:${orgId}`,
    RATE_LIMITS.onboardingCalibrationGateAdmin
  );
  if (!gateRl.ok) return null;
  const { data: mem } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem || mem.role !== "admin") return null;
  const v6 = await getV6OrgSettingsJson(admin, orgId);
  const cal = parseOnboardingCalibration(v6.onboarding_calibration);
  if (isOnboardingBlockingForAdmin({ role: "admin", calibration: cal })) {
    return CALIBRATION_PATH;
  }
  return null;
}

/**
 * Edge/proxy: RLS-scoped reads only (no service role).
 */
export async function resolveBlockingCalibrationPathForUserClient(
  supabase: SupabaseClient
): Promise<string | null> {
  if (isOnboardingCalibrationGateDisabled()) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const userGate = await rateLimitCheck(
    `onboarding-calibration:gate:${user.id}`,
    RATE_LIMITS.onboardingCalibrationGateUser
  );
  if (!userGate.ok) return null;
  const { data: rows, error: memErr } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(2);
  if (memErr || rows?.length !== 1) return null;
  const row = rows[0];
  if (row.role !== "admin") return null;
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("v6_org_settings_json")
    .eq("id", row.organization_id)
    .maybeSingle();
  if (orgErr || !org) return null;
  const raw = (org as { v6_org_settings_json?: unknown }).v6_org_settings_json;
  const v6 = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const cal = parseOnboardingCalibration(v6.onboarding_calibration);
  return isOnboardingBlockingForAdmin({ role: "admin", calibration: cal }) ? CALIBRATION_PATH : null;
}
