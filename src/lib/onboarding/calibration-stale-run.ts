import * as Sentry from "@sentry/nextjs";
import { applyBlockingCalibrationMinimalSkip } from "@/lib/onboarding/calibration-blocking-minimal";
import {
  evaluateBlockingCalibrationStalePhase1,
  evaluateBlockingCalibrationStalePhase2,
} from "@/lib/onboarding/calibration-stale-expiry";
import {
  getOnboardingCalibrationPendingStaleAfterDays,
  getOnboardingCalibrationStaleAfterDays,
  getOnboardingCalibrationStaleMsBetweenOrgs,
  isOnboardingCalibrationStaleCronDryRun,
} from "@/lib/onboarding/calibration-stale-env";
import { parseOnboardingCalibration } from "@/lib/onboarding/calibration-types";
import type { AdminClient } from "@/lib/assurance/service";
import { getOrgSettingsJson } from "@/lib/assurance/org-settings";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type OnboardingCalibrationStaleCronResult = {
  ok: boolean;
  scanned: number;
  expired: number;
  would_expire: number;
  skipped_ineligible: number;
  skipped_stale_race: number;
  skipped_bad_timestamp: number;
  /** Phase-2 pending sweep: organizations.created_at missing when age policy is enabled. */
  skipped_missing_org_created_at: number;
  errors_no_admin: number;
  errors_merge: number;
  errors_count: number;
  truncation_warning: boolean;
  org_cap: number;
  backpressure_ms: number;
  dry_run: boolean;
};

async function resolveFirstAdminUserId(
  admin: AdminClient,
  orgId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  return String(data[0].user_id);
}

async function fetchOrgCreatedAtIso(
  admin: AdminClient,
  orgId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("organizations")
    .select("created_at")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return null;
  const c = (data as { created_at?: string | null }).created_at;
  return typeof c === "string" ? c : null;
}

/**
 * Service-role sweep: expire blocking in_progress (and optionally pending) calibrations past age thresholds.
 * No global revalidatePath — users pick up on next navigation.
 *
 * Concurrency: overlapping cron runs may both see eligibility; the re-fetch + re-check before merge makes
 * the expire transition idempotent (second pass typically increments skipped_stale_race). No distributed lock in v1.
 */
export async function runOnboardingCalibrationStaleCron(input: {
  admin: AdminClient;
  orgIds: string[];
  /** True when listOrganizationIds cap may hide additional orgs (pagination FUTURE). */
  orgCapTruncated: boolean;
  /** Hard cap from lister (e.g. 500) for operator visibility. */
  listerOrgCap: number;
}): Promise<OnboardingCalibrationStaleCronResult> {
  const dryRun = isOnboardingCalibrationStaleCronDryRun();
  const staleDays = getOnboardingCalibrationStaleAfterDays();
  const pendingStaleDays = getOnboardingCalibrationPendingStaleAfterDays();
  const backpressureMs = getOnboardingCalibrationStaleMsBetweenOrgs();
  const nowMs = Date.now();

  let expired = 0;
  let would_expire = 0;
  let skipped_ineligible = 0;
  let skipped_stale_race = 0;
  let skipped_bad_timestamp = 0;
  let skipped_missing_org_created_at = 0;
  let errors_no_admin = 0;
  let errors_merge = 0;
  let errors_count = 0;

  for (const orgId of input.orgIds) {
    try {
      const prevV6 = await getOrgSettingsJson(input.admin, orgId);
      const prevCal = parseOnboardingCalibration(prevV6.onboarding_calibration);
      if (!prevCal) {
        skipped_ineligible += 1;
        continue;
      }

      const p1 = evaluateBlockingCalibrationStalePhase1({
        cal: prevCal,
        nowMs,
        staleAfterDays: staleDays,
      });
      if (p1.badOrFutureTimestamp) {
        skipped_bad_timestamp += 1;
        continue;
      }

      let phase: 1 | 2 | null = null;
      if (p1.eligible) {
        phase = 1;
      } else if (pendingStaleDays !== null) {
        if (prevCal.blocking_required && prevCal.status === "pending") {
          const createdIso = await fetchOrgCreatedAtIso(input.admin, orgId);
          if (createdIso === null) {
            skipped_missing_org_created_at += 1;
            continue;
          }
          if (
            evaluateBlockingCalibrationStalePhase2({
              cal: prevCal,
              orgCreatedAtIso: createdIso,
              nowMs,
              pendingStaleAfterDays: pendingStaleDays,
            })
          ) {
            phase = 2;
          }
        }
      }

      if (phase === null) {
        skipped_ineligible += 1;
        continue;
      }

      const prevV6b = await getOrgSettingsJson(input.admin, orgId);
      const prevCalb = parseOnboardingCalibration(prevV6b.onboarding_calibration);
      if (!prevCalb) {
        skipped_stale_race += 1;
        continue;
      }

      let stillEligible = false;
      if (phase === 1) {
        const p1b = evaluateBlockingCalibrationStalePhase1({
          cal: prevCalb,
          nowMs,
          staleAfterDays: staleDays,
        });
        stillEligible = p1b.eligible && !p1b.badOrFutureTimestamp;
      } else if (pendingStaleDays !== null) {
        const createdIsoB = await fetchOrgCreatedAtIso(input.admin, orgId);
        stillEligible = evaluateBlockingCalibrationStalePhase2({
          cal: prevCalb,
          orgCreatedAtIso: createdIsoB,
          nowMs,
          pendingStaleAfterDays: pendingStaleDays,
        });
      }
      if (!stillEligible) {
        skipped_stale_race += 1;
        continue;
      }

      const actorUserId = await resolveFirstAdminUserId(input.admin, orgId);
      if (!actorUserId) {
        errors_no_admin += 1;
        errors_count += 1;
        continue;
      }

      if (dryRun) {
        would_expire += 1;
        continue;
      }

      const applied = await applyBlockingCalibrationMinimalSkip({
        admin: input.admin,
        orgId,
        actorUserId,
        prevV6: prevV6b,
        prevCal: prevCalb,
        choice: "skip",
      });

      if (!applied.ok) {
        errors_merge += 1;
        errors_count += 1;
        Sentry.captureMessage("onboarding.calibration_stale_expire_merge_failed", {
          level: "error",
          tags: { cron_job: "onboarding-calibration-stale" },
          extra: { orgId },
        });
        continue;
      }

      await input.admin.from("audit_events").insert({
        organization_id: orgId,
        contract_id: null,
        user_id: actorUserId,
        action: "onboarding.questionnaire_stale_expired",
        details: { stale_after_days: phase === 1 ? staleDays : pendingStaleDays, phase },
      });

      expired += 1;

      if (backpressureMs > 0) {
        await sleep(backpressureMs);
      }
    } catch {
      errors_count += 1;
      Sentry.captureMessage("onboarding.calibration_stale_expire_org_error", {
        level: "error",
        tags: { cron_job: "onboarding-calibration-stale" },
        extra: { orgId },
      });
    }
  }

  return {
    ok: true,
    scanned: input.orgIds.length,
    expired,
    would_expire,
    skipped_ineligible,
    skipped_stale_race,
    skipped_bad_timestamp,
    skipped_missing_org_created_at,
    errors_no_admin,
    errors_merge,
    errors_count,
    truncation_warning: input.orgCapTruncated,
    org_cap: input.listerOrgCap,
    backpressure_ms: backpressureMs,
    dry_run: dryRun,
  };
}
