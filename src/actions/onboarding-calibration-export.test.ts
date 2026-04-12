import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportOnboardingCalibrationSupportJson } from "@/actions/onboarding-calibration";

const rateLimitCheck = vi.hoisted(() => vi.fn());
const getClientIpFromHeaders = vi.hoisted(() => vi.fn(async () => "203.0.113.2"));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitCheck,
    getClientIpFromHeaders,
  };
});

const getV6OrgSettingsJson = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn(async () => ({ error: null })));

const getAuthContext = vi.hoisted(() =>
  vi.fn(async () => ({
    user: { id: "user-exp-1" },
    orgId: "org-target-9",
    role: "admin" as const,
    admin: {
      from: vi.fn((table: string) => {
        if (table === "audit_events") {
          return { insert: insertMock };
        }
        return { insert: vi.fn() };
      }),
    },
  }))
);

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext,
}));

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson,
}));

describe("exportOnboardingCalibrationSupportJson", () => {
  beforeEach(() => {
    rateLimitCheck.mockReset();
    rateLimitCheck.mockResolvedValue({ ok: true });
    insertMock.mockClear();
    getV6OrgSettingsJson.mockReset();
    getV6OrgSettingsJson.mockImplementation(async (_admin: unknown, orgId: string) => {
      expect(orgId).toBe("org-target-9");
      return {
        onboarding_calibration: {
          version: 2,
          blocking_required: false,
          status: "completed",
        },
      };
    });
  });

  it("returns JSON scoped to auth org (getV6OrgSettingsJson org id)", async () => {
    const res = await exportOnboardingCalibrationSupportJson();
    expect(getV6OrgSettingsJson).toHaveBeenCalled();
    const firstCall = getV6OrgSettingsJson.mock.calls[0];
    expect(firstCall?.[1]).toBe("org-target-9");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const parsed = JSON.parse(res.json) as { organization_fingerprint?: string; onboarding_calibration?: { status?: string } };
    expect(parsed.onboarding_calibration?.status).toBe("completed");
    expect(typeof parsed.organization_fingerprint).toBe("string");
    expect(insertMock).toHaveBeenCalled();
  });

  it("rejects unexpected object input", async () => {
    const res = await exportOnboardingCalibrationSupportJson({ foo: "bar" } as never);
    expect(res.ok).toBe(false);
  });
});
