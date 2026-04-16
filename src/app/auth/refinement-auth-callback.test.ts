import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const ensureUserOrg = vi.fn();
const getUserPrimaryOrganizationId = vi.fn();
const resolvePostAuthRedirectPath = vi.fn();
const resolveBlockingCalibrationPathForAdminOrg = vi.fn();
const resolveDestinationWithBlockingCalibration = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
    },
  })),
  createAdminClient: vi.fn(async () => ({})),
  ensureUserOrg,
  resolveDefaultOrganizationNameForUser: vi.fn(() => "My Organization"),
}));

vi.mock("@/lib/auth/post-auth-redirect", () => ({
  getUserPrimaryOrganizationId,
  resolvePostAuthRedirectPath,
  resolveDestinationWithBlockingCalibration,
}));

vi.mock("@/lib/onboarding/calibration-gate", () => ({
  resolveBlockingCalibrationPathForAdminOrg,
}));

describe("auth callback org provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          user_metadata: {},
        },
      },
      error: null,
    });
    ensureUserOrg.mockResolvedValue(undefined);
    getUserPrimaryOrganizationId.mockResolvedValue("org_1");
    resolvePostAuthRedirectPath.mockResolvedValue("/dashboard");
    resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue(null);
    resolveDestinationWithBlockingCalibration.mockReturnValue("/dashboard");
  });

  it("provisions an org for non-invite callbacks and redirects to the resolved destination", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));
    expect(ensureUserOrg).toHaveBeenCalledWith("user_1", "My Organization");
    expect(getUserPrimaryOrganizationId).toHaveBeenCalled();
    expect(resolvePostAuthRedirectPath).toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });
});
