import { NextResponse } from "next/server";
import { withCronRoute } from "@/lib/cron/route-runner";
import { RATE_LIMITS, getClientIpFromRequest } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { isOnboardingCalibrationStaleCronDisabled } from "@/lib/onboarding/calibration-stale-env";
import { runOnboardingCalibrationStaleCron } from "@/lib/onboarding/calibration-stale-run";
import {
  listOrganizationIds,
  logV6Cron,
  v6CronRunMetadata,
} from "@/lib/assurance/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LIST_ORG_CAP = 500;

const CRON_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

export const GET = withCronRoute({
  route: "/api/cron/v6/onboarding-calibration-stale",
  rateLimitKey: (request) => `cron:v6:onboarding-calibration-stale:${getClientIpFromRequest(request)}`,
  rateLimit: RATE_LIMITS.v6OnboardingCalibrationStaleCron,
  responseHeaders: CRON_SECURITY_HEADERS,
  preflight: () => {
    if (!isOnboardingCalibrationStaleCronDisabled()) return null;
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" }, { status: 200 });
  },
  adminFactory: () => createAdminClient(),
  handler: async ({ admin, startedAtMs }) => {
    const orgScan = await listOrganizationIds(admin);
    if (orgScan.error) {
      return {
        status: 500,
        ok: false,
        errorsCount: 1,
        phase: "source_query",
        body: {
          error: "Failed to load organizations for onboarding calibration stale cron",
          code: "v6_onboarding_calibration_org_query_failed",
          diagnostic_id: "v6_onboarding_calibration_org_query_failed",
        },
      };
    }
    const orgIds = orgScan.orgIds;
    const orgCapTruncated = orgScan.stoppedByOffsetCap || orgIds.length >= LIST_ORG_CAP;

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

    const meta = v6CronRunMetadata(result.scanned, startedAtMs, result.errors_count);
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

    return {
      ok: result.ok,
      partial: result.errors_count > 0,
      errorsCount: result.errors_count,
      body: {
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
      },
    };
  },
});
