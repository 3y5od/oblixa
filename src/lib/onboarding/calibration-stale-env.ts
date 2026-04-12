/**
 * Env parsing for onboarding calibration stale cron (docs/onboarding.md §4.4).
 * Invalid numeric env falls back to defaults (fail-open for operators).
 */

function envTruthy(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Finite, integer, nonnegative; otherwise defaultVal (fail-open for operators). */
function parseNonnegativeInt(raw: string | undefined, defaultVal: number): number {
  if (raw === undefined || raw.trim() === "") return defaultVal;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return defaultVal;
  return n;
}

/** Same rules as {@link parseNonnegativeInt}; invalid or empty → null (phase-2 off). */
function parseOptionalNonnegativeInt(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

export function isOnboardingCalibrationStaleCronDisabled(): boolean {
  return envTruthy(process.env.DISABLE_ONBOARDING_CALIBRATION_STALE_CRON);
}

export function isOnboardingCalibrationStaleCronDryRun(): boolean {
  return envTruthy(process.env.ONBOARDING_CALIBRATION_STALE_CRON_DRY_RUN);
}

/** Default 30 days. */
export function getOnboardingCalibrationStaleAfterDays(): number {
  return parseNonnegativeInt(process.env.ONBOARDING_CALIBRATION_STALE_AFTER_DAYS, 30);
}

/** When unset or empty, phase-2 pending sweep is disabled. */
export function getOnboardingCalibrationPendingStaleAfterDays(): number | null {
  return parseOptionalNonnegativeInt(process.env.ONBOARDING_CALIBRATION_PENDING_STALE_AFTER_DAYS);
}

export function getOnboardingCalibrationStaleMsBetweenOrgs(): number {
  return parseNonnegativeInt(process.env.ONBOARDING_CALIBRATION_STALE_MS_BETWEEN_ORGS, 0);
}
