import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const ensureUserOrg = vi.fn();
const getUserPrimaryOrganizationId = vi.fn();
const resolvePostAuthRedirectPath = vi.fn();
const resolveBlockingCalibrationPathForAdminOrg = vi.fn();
const resolveDestinationWithBlockingCalibration = vi.fn();
const adminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
    },
  })),
  createAdminClient: vi.fn(async () => ({ from: adminFrom })),
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
    adminFrom.mockReset();
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

  it("rejects invite callbacks when the signed-in email does not match the invite target", async () => {
    const inviteId = "00000000-0000-4000-8000-000000000001";
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          user_metadata: { invite_id: inviteId },
        },
      },
      error: null,
    });
    adminFrom.mockImplementation((table: string) => {
      expect(table).toBe("organization_invites");
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: inviteId,
            organization_id: "org_1",
            email: "other@example.com",
            role: "viewer",
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            consumed_at: null,
            revoked_at: null,
          },
          error: null,
        }),
      };
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(ensureUserOrg).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invite_email_mismatch");
  });

  it("rejects invite callbacks when the invite is expired", async () => {
    const inviteId = "00000000-0000-4000-8000-000000000002";
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          user_metadata: { invite_id: inviteId },
        },
      },
      error: null,
    });
    adminFrom.mockImplementation((table: string) => {
      expect(table).toBe("organization_invites");
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: inviteId,
            organization_id: "org_1",
            email: "user@example.com",
            role: "viewer",
            expires_at: new Date(Date.now() - 60_000).toISOString(),
            consumed_at: null,
            revoked_at: null,
          },
          error: null,
        }),
      };
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(ensureUserOrg).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invite_invalid");
  });
});
