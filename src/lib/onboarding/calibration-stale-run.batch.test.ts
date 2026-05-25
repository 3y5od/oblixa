import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  applySkip: vi.fn(),
  getV6: vi.fn(),
  pendingDays: vi.fn((): number | null => null),
  dryRun: vi.fn(() => false),
  staleDays: vi.fn(() => 1),
  msBetween: vi.fn(() => 0),
}));

vi.mock("@/lib/onboarding/calibration-blocking-minimal", () => ({
  applyBlockingCalibrationMinimalSkip: (...args: unknown[]) => hoisted.applySkip(...args),
}));

vi.mock("@/lib/onboarding/calibration-stale-env", () => ({
  getOnboardingCalibrationPendingStaleAfterDays: () => hoisted.pendingDays(),
  getOnboardingCalibrationStaleAfterDays: () => hoisted.staleDays(),
  getOnboardingCalibrationStaleMsBetweenOrgs: () => hoisted.msBetween(),
  isOnboardingCalibrationStaleCronDryRun: () => hoisted.dryRun(),
}));

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => hoisted.getV6(...args),
}));

import { runOnboardingCalibrationStaleCron } from "@/lib/onboarding/calibration-stale-run";

describe("runOnboardingCalibrationStaleCron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    hoisted.applySkip.mockClear();
    hoisted.getV6.mockReset();
    hoisted.pendingDays.mockReturnValue(null);
    hoisted.dryRun.mockReturnValue(false);
    hoisted.staleDays.mockReturnValue(1);
    hoisted.msBetween.mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dry-run increments would_expire and never calls merge helper", async () => {
    hoisted.dryRun.mockReturnValue(true);
    hoisted.getV6.mockResolvedValue({
      onboarding_calibration: {
        version: 2,
        blocking_required: true,
        status: "in_progress",
        questionnaire_started_at: "2026-01-01T00:00:00.000Z",
      },
    });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "organization_members") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [{ user_id: "u-admin" }], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as never;

    const r = await runOnboardingCalibrationStaleCron({
      admin,
      orgIds: ["org-1"],
      orgCapTruncated: false,
      listerOrgCap: 500,
    });
    expect(r.dry_run).toBe(true);
    expect(r.would_expire).toBe(1);
    expect(r.expired).toBe(0);
    expect(hoisted.applySkip).not.toHaveBeenCalled();
  });

  it("phase-2 pending path counts skipped_missing_org_created_at when organizations.created_at is absent", async () => {
    hoisted.pendingDays.mockReturnValue(30);
    hoisted.dryRun.mockReturnValue(false);
    hoisted.getV6.mockResolvedValue({
      onboarding_calibration: {
        version: 2,
        blocking_required: true,
        status: "pending",
      },
    });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { created_at: null },
                    error: null,
                  }),
              }),
            }),
          };
        }
        return {};
      }),
    } as never;

    const r = await runOnboardingCalibrationStaleCron({
      admin,
      orgIds: ["org-2"],
      orgCapTruncated: false,
      listerOrgCap: 500,
    });
    expect(r.skipped_missing_org_created_at).toBe(1);
    expect(hoisted.applySkip).not.toHaveBeenCalled();
  });

  it("phase-2 pending + old organizations.created_at dry-run counts would_expire (plan B.2)", async () => {
    hoisted.pendingDays.mockReturnValue(30);
    hoisted.dryRun.mockReturnValue(true);
    hoisted.getV6.mockResolvedValue({
      onboarding_calibration: {
        version: 2,
        blocking_required: true,
        status: "pending",
      },
    });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { created_at: "2020-01-01T00:00:00.000Z" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "organization_members") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [{ user_id: "u-admin" }], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as never;

    const r = await runOnboardingCalibrationStaleCron({
      admin,
      orgIds: ["org-phase2"],
      orgCapTruncated: false,
      listerOrgCap: 500,
    });
    expect(r.would_expire).toBe(1);
    expect(hoisted.applySkip).not.toHaveBeenCalled();
  });
});
