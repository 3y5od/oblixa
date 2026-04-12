import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportOnboardingCalibrationSupportJson,
  previewCalibrationRecommendation,
  recordQuestionnaireStarted,
} from "@/actions/onboarding-calibration";

const rateLimitCheck = vi.hoisted(() => vi.fn());
const getClientIpFromHeaders = vi.hoisted(() => vi.fn(async () => "203.0.113.1"));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitCheck,
    getClientIpFromHeaders,
  };
});

const auditFrom = vi.hoisted(() =>
  vi.fn((table: string) => {
    if (table === "audit_events") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: vi.fn(async () => ({ error: null })),
      };
    }
    return {};
  })
);

const getAuthContext = vi.hoisted(() =>
  vi.fn(async () => ({
    user: { id: "user-rate-1" },
    orgId: "org-rate-1",
    role: "admin" as const,
    admin: { from: auditFrom },
  }))
);

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext,
}));

const getV6OrgSettingsJson = vi.hoisted(() =>
  vi.fn(async () => ({
    onboarding_calibration: {
      version: 2,
      blocking_required: true,
      status: "pending",
    },
  }))
);

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson,
  mergeV6OrgSettingsJson: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: vi.fn(() => ({})),
}));

describe("onboarding-calibration rate limits", () => {
  beforeEach(() => {
    rateLimitCheck.mockReset();
    getClientIpFromHeaders.mockClear();
    rateLimitCheck.mockResolvedValue({ ok: true });
    getV6OrgSettingsJson.mockImplementation(async () => ({
      onboarding_calibration: {
        version: 2,
        blocking_required: true,
        status: "pending",
      },
    }));
  });

  it("returns Too many requests when preview bucket is exhausted", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    const res = await previewCalibrationRecommendation({
      answers_required: {
        primary_use_case: "track_contracts_dates",
        team_model: "solo",
        workflow_maturity: "manual_spreadsheet",
        main_pain: "find_contracts_dates",
        complexity_preference: "simplest",
        setup_intent: "upload_import",
        assurance_intent: "not_now",
      },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Too many requests/i);
  });

  it("returns Too many requests when mutation bucket is exhausted", async () => {
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    const res = await recordQuestionnaireStarted();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Too many requests/i);
  });

  it("returns Too many requests when export bucket is exhausted", async () => {
    getV6OrgSettingsJson.mockResolvedValueOnce({
      onboarding_calibration: {
        version: 2,
        blocking_required: false,
        status: "completed",
      },
    });
    rateLimitCheck.mockResolvedValueOnce({ ok: false, retryAfterMs: 5000 });
    const res = await exportOnboardingCalibrationSupportJson();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Too many requests/i);
  });
});
