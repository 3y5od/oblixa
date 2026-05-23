import { getSafeRedirectPath } from "@/lib/security/redirect";
import type { AdminClient } from "@/lib/v6/service";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import { resolveEffectiveLandingPath } from "@/lib/product-surface/landing-eligibility";

/**
 * Blocking first-run calibration overrides the post-auth landing path (OAuth and similar flows).
 */
export function resolveDestinationWithBlockingCalibration(
  postAuthDestination: string,
  blockingCalibrationPath: string | null | undefined
): string {
  if (blockingCalibrationPath) return blockingCalibrationPath;
  return postAuthDestination;
}

/**
 * When the user lands on the default app home, honor org default landing (product-surface policy §21.2).
 * Invalid paths for the org workspace mode are ignored (open-redirect safe via getSafeRedirectPath).
 */
export async function resolvePostAuthRedirectPath(
  admin: AdminClient,
  orgId: string | null,
  requestedPath: string
): Promise<string> {
  const homePaths = new Set(["/dashboard", getSafeRedirectPath(null)]);
  if (!homePaths.has(requestedPath)) return requestedPath;
  if (!orgId) return requestedPath;
  const v6 = await getV6OrgSettingsJson(admin, orgId);
  const mode = parseWorkspaceMode(v6);
  const resolved = resolveEffectiveLandingPath(v6.default_landing_path, mode);
  return getSafeRedirectPath(resolved);
}

export async function getUserPrimaryOrganizationId(
  admin: AdminClient,
  userId: string
): Promise<string | null> {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(2);
  const rows = Array.isArray(data) ? (data as { organization_id?: string }[]) : [];
  if (rows.length !== 1) return null;
  const row = rows[0];
  return row?.organization_id ?? null;
}
