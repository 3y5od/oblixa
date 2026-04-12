import { NextResponse } from "next/server";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { isOnboardingCalibrationStaleCronDisabled } from "@/lib/onboarding/calibration-stale-env";
import { runOnboardingCalibrationStaleCron } from "@/lib/onboarding/calibration-stale-run";
import {
  listOrganizationIds,
  logV6Cron,
  requireV6CronAuth,
  v6CronRunMetadata,
} from "@/lib/v6/cron";

export const maxDuration = 120;

const LIST_ORG_CAP = 500;

const CRON_SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function jsonWithSecurity(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: CRON_SECURITY_HEADERS,
  });
}

export async function GET(request: Request) {
  const unauthorized = requireV6CronAuth(request);
  if (unauthorized) {
    for (const [k, v] of Object.entries(CRON_SECURITY_HEADERS)) {
      unauthorized.headers.set(k, v);
    }
    return unauthorized;
  }

  if (isOnboardingCalibrationStaleCronDisabled()) {
    return jsonWithSecurity({ skipped: true, reason: "disabled" });
  }

  const ip = getClientIpFromRequest(request);
  const rate = await rateLimitCheck(`cron:v6:onboarding-calibration-stale:${ip}`, RATE_LIMITS.v6OnboardingCalibrationStaleCron);
  if (!rate.ok) {
    return jsonWithSecurity(
      { error: "Too many requests", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }

  const t0 = Date.now();
  const admin = await createAdminClient();
  const orgIds = await listOrganizationIds(admin);
  const orgCapTruncated = orgIds.length >= LIST_ORG_CAP;

  logV6Cron("onboarding-calibration-stale", "batch_start", {
    orgs_scanned: orgIds.length,
    org_cap: LIST_ORG_CAP,
    truncation_warning: orgCapTruncated,
  });

  const result = await runOnboardingCalibrationStaleCron({
    admin,
    orgIds,
    orgCapTruncated,
    listerOrgCap: LIST_ORG_CAP,
  });

  const meta = v6CronRunMetadata(result.scanned, t0, result.errors_count);
  // No global revalidatePath after batch: impractical for every org; users unstick on next navigation (see calibration-stale-run).

  logV6Cron("onboarding-calibration-stale", "batch_complete", {
    expired: result.expired,
    would_expire: result.would_expire,
    skipped_ineligible: result.skipped_ineligible,
    skipped_stale_race: result.skipped_stale_race,
    skipped_bad_timestamp: result.skipped_bad_timestamp,
    skipped_missing_org_created_at: result.skipped_missing_org_created_at,
    errors_no_admin: result.errors_no_admin,
    errors_merge: result.errors_merge,
    errors_count: result.errors_count,
    dry_run: result.dry_run,
  });

  return jsonWithSecurity({
    ok: result.ok,
    expired: result.expired,
    scanned: result.scanned,
    orgs_scanned: result.scanned,
    would_expire: result.would_expire,
    skipped_ineligible: result.skipped_ineligible,
    skipped_stale_race: result.skipped_stale_race,
    skipped_bad_timestamp: result.skipped_bad_timestamp,
    skipped_missing_org_created_at: result.skipped_missing_org_created_at,
    errors_no_admin: result.errors_no_admin,
    errors_merge: result.errors_merge,
    dry_run: result.dry_run,
    truncation_warning: result.truncation_warning,
    org_cap: result.org_cap,
    backpressure_ms: result.backpressure_ms,
    ...meta,
  });
}
