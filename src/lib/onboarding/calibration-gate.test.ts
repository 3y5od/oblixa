import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isOnboardingCalibrationGateDisabled,
  resolveBlockingCalibrationPathForAdminOrg,
  resolveBlockingCalibrationPathForUserClient,
} from "@/lib/onboarding/calibration-gate";

const rateLimitCheckMock = vi.hoisted(() =>
  vi.fn(async (): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> => ({ ok: true }))
);

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimitCheck: rateLimitCheckMock };
});

describe("calibration-gate kill switch", () => {
  beforeEach(() => {
    rateLimitCheckMock.mockReset();
    rateLimitCheckMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isOnboardingCalibrationGateDisabled is true when DISABLE_ONBOARDING_CALIBRATION_GATE=1", () => {
    vi.stubEnv("DISABLE_ONBOARDING_CALIBRATION_GATE", "1");
    expect(isOnboardingCalibrationGateDisabled()).toBe(true);
  });

  it("isOnboardingCalibrationGateDisabled is true when value is true", () => {
    vi.stubEnv("DISABLE_ONBOARDING_CALIBRATION_GATE", "true");
    expect(isOnboardingCalibrationGateDisabled()).toBe(true);
  });

  it("isOnboardingCalibrationGateDisabled is false when unset", () => {
    vi.stubEnv("DISABLE_ONBOARDING_CALIBRATION_GATE", "");
    expect(isOnboardingCalibrationGateDisabled()).toBe(false);
  });

  it("resolveBlockingCalibrationPathForAdminOrg returns null when gate is disabled (no redirect path)", async () => {
    vi.stubEnv("DISABLE_ONBOARDING_CALIBRATION_GATE", "1");
    const path = await resolveBlockingCalibrationPathForAdminOrg({
      admin: {} as never,
      userId: "user-1",
      orgId: "org-1",
    });
    expect(path).toBeNull();
  });

  it("resolveBlockingCalibrationPathForAdminOrg returns null when gate rate limit fails", async () => {
    rateLimitCheckMock.mockResolvedValueOnce({ ok: false, retryAfterMs: 1000 });
    const path = await resolveBlockingCalibrationPathForAdminOrg({
      admin: {} as never,
      userId: "user-1",
      orgId: "org-1",
    });
    expect(path).toBeNull();
  });

  it("resolveBlockingCalibrationPathForUserClient returns null when gate rate limit fails", async () => {
    rateLimitCheckMock.mockResolvedValueOnce({ ok: false, retryAfterMs: 1000 });
    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null })),
      },
    } as never;
    const path = await resolveBlockingCalibrationPathForUserClient(supabase);
    expect(path).toBeNull();
  });
});
