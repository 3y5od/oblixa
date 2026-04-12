import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOnboardingCalibrationPendingStaleAfterDays,
  getOnboardingCalibrationStaleAfterDays,
  getOnboardingCalibrationStaleMsBetweenOrgs,
  isOnboardingCalibrationStaleCronDisabled,
  isOnboardingCalibrationStaleCronDryRun,
} from "@/lib/onboarding/calibration-stale-env";

describe("calibration-stale-env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses disable / dry-run flags case-insensitively", () => {
    vi.stubEnv("DISABLE_ONBOARDING_CALIBRATION_STALE_CRON", "YES");
    expect(isOnboardingCalibrationStaleCronDisabled()).toBe(true);
    vi.stubEnv("ONBOARDING_CALIBRATION_STALE_CRON_DRY_RUN", "True");
    expect(isOnboardingCalibrationStaleCronDryRun()).toBe(true);
  });

  it("falls back stale-after days when env is invalid", () => {
    vi.stubEnv("ONBOARDING_CALIBRATION_STALE_AFTER_DAYS", "-5");
    expect(getOnboardingCalibrationStaleAfterDays()).toBe(30);
  });

  it("rejects non-integer numeric strings for stale-after (plan B.12)", () => {
    vi.stubEnv("ONBOARDING_CALIBRATION_STALE_AFTER_DAYS", "14.5");
    expect(getOnboardingCalibrationStaleAfterDays()).toBe(30);
    vi.stubEnv("ONBOARDING_CALIBRATION_STALE_AFTER_DAYS", "NaN");
    expect(getOnboardingCalibrationStaleAfterDays()).toBe(30);
  });

  it("disables pending phase-2 when env empty or invalid", () => {
    vi.stubEnv("ONBOARDING_CALIBRATION_PENDING_STALE_AFTER_DAYS", "");
    expect(getOnboardingCalibrationPendingStaleAfterDays()).toBeNull();
    vi.stubEnv("ONBOARDING_CALIBRATION_PENDING_STALE_AFTER_DAYS", "nope");
    expect(getOnboardingCalibrationPendingStaleAfterDays()).toBeNull();
    vi.stubEnv("ONBOARDING_CALIBRATION_PENDING_STALE_AFTER_DAYS", "7.1");
    expect(getOnboardingCalibrationPendingStaleAfterDays()).toBeNull();
  });

  it("parses ms-between-orgs with default 0", () => {
    vi.stubEnv("ONBOARDING_CALIBRATION_STALE_MS_BETWEEN_ORGS", "");
    expect(getOnboardingCalibrationStaleMsBetweenOrgs()).toBe(0);
    vi.stubEnv("ONBOARDING_CALIBRATION_STALE_MS_BETWEEN_ORGS", "100");
    expect(getOnboardingCalibrationStaleMsBetweenOrgs()).toBe(100);
  });
});
