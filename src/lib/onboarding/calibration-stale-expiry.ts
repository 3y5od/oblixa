import type { OnboardingCalibrationState } from "@/lib/onboarding/calibration-types";

export type StalePhase = 1 | 2;

/** Parse ISO; return null if invalid. */
export function parseCalibrationIsoMs(iso: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return t;
}

/**
 * Phase 1: blocking_required + in_progress + started_at older than threshold (UTC ms).
 * Returns eligibility and whether started_at was bad/future (for metrics only).
 */
export function evaluateBlockingCalibrationStalePhase1(input: {
  cal: OnboardingCalibrationState;
  nowMs: number;
  staleAfterDays: number;
}): {
  eligible: boolean;
  badOrFutureTimestamp: boolean;
} {
  const { cal, nowMs, staleAfterDays } = input;
  if (!cal.blocking_required) return { eligible: false, badOrFutureTimestamp: false };
  if (cal.status !== "in_progress") return { eligible: false, badOrFutureTimestamp: false };
  const started = cal.questionnaire_started_at;
  if (!started || typeof started !== "string") {
    return { eligible: false, badOrFutureTimestamp: false };
  }
  const startedMs = parseCalibrationIsoMs(started);
  if (startedMs === null) return { eligible: false, badOrFutureTimestamp: true };
  if (startedMs > nowMs) return { eligible: false, badOrFutureTimestamp: true };
  const ageMs = nowMs - startedMs;
  const thresholdMs = staleAfterDays * 86_400_000;
  return { eligible: ageMs > thresholdMs, badOrFutureTimestamp: false };
}

/**
 * Phase 2: blocking_required + pending + org created_at older than threshold.
 */
export function evaluateBlockingCalibrationStalePhase2(input: {
  cal: OnboardingCalibrationState;
  orgCreatedAtIso: string | null | undefined;
  nowMs: number;
  pendingStaleAfterDays: number;
}): boolean {
  const { cal, orgCreatedAtIso, nowMs, pendingStaleAfterDays } = input;
  if (!cal.blocking_required) return false;
  if (cal.status !== "pending") return false;
  if (!orgCreatedAtIso || typeof orgCreatedAtIso !== "string") return false;
  const createdMs = parseCalibrationIsoMs(orgCreatedAtIso);
  if (createdMs === null) return false;
  const ageMs = nowMs - createdMs;
  const thresholdMs = pendingStaleAfterDays * 86_400_000;
  return ageMs > thresholdMs;
}
