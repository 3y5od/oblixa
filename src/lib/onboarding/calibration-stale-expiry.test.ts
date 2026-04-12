import { describe, expect, it } from "vitest";
import {
  evaluateBlockingCalibrationStalePhase1,
  evaluateBlockingCalibrationStalePhase2,
  parseCalibrationIsoMs,
} from "@/lib/onboarding/calibration-stale-expiry";
import type { OnboardingCalibrationState } from "@/lib/onboarding/calibration-types";

const baseCal = (patch: Partial<OnboardingCalibrationState>): OnboardingCalibrationState => ({
  version: 2,
  blocking_required: true,
  status: "in_progress",
  ...patch,
});

describe("calibration-stale-expiry", () => {
  it("parseCalibrationIsoMs rejects invalid ISO", () => {
    expect(parseCalibrationIsoMs("not-a-date")).toBeNull();
  });

  it("phase1 skips non-blocking and optional recalibration (blocking_required false)", () => {
    const cal = baseCal({ blocking_required: false, status: "in_progress" });
    const r = evaluateBlockingCalibrationStalePhase1({
      cal,
      nowMs: Date.UTC(2026, 3, 10),
      staleAfterDays: 1,
    });
    expect(r).toEqual({ eligible: false, badOrFutureTimestamp: false });
  });

  it("phase1 marks bad timestamp when started_at is malformed", () => {
    const cal = baseCal({ questionnaire_started_at: "garbage" });
    const r = evaluateBlockingCalibrationStalePhase1({
      cal,
      nowMs: Date.UTC(2026, 3, 10),
      staleAfterDays: 1,
    });
    expect(r.badOrFutureTimestamp).toBe(true);
    expect(r.eligible).toBe(false);
  });

  it("phase1 marks future started_at as bad timestamp", () => {
    const cal = baseCal({ questionnaire_started_at: "2099-01-01T00:00:00.000Z" });
    const nowMs = Date.UTC(2026, 3, 10);
    const r = evaluateBlockingCalibrationStalePhase1({ cal, nowMs, staleAfterDays: 1 });
    expect(r.badOrFutureTimestamp).toBe(true);
    expect(r.eligible).toBe(false);
  });

  it("phase1 eligible when age exceeds threshold (UTC)", () => {
    const cal = baseCal({ questionnaire_started_at: "2026-04-01T00:00:00.000Z" });
    const nowMs = Date.UTC(2026, 4, 2);
    const r = evaluateBlockingCalibrationStalePhase1({ cal, nowMs, staleAfterDays: 30 });
    expect(r.badOrFutureTimestamp).toBe(false);
    expect(r.eligible).toBe(true);
  });

  it("phase2 requires pending blocking and valid org created_at age", () => {
    const cal = baseCal({ status: "pending" });
    const nowMs = Date.UTC(2026, 4, 10);
    expect(
      evaluateBlockingCalibrationStalePhase2({
        cal,
        orgCreatedAtIso: "2026-01-01T00:00:00.000Z",
        nowMs,
        pendingStaleAfterDays: 30,
      })
    ).toBe(true);
    expect(
      evaluateBlockingCalibrationStalePhase2({
        cal,
        orgCreatedAtIso: null,
        nowMs,
        pendingStaleAfterDays: 30,
      })
    ).toBe(false);
  });
});
