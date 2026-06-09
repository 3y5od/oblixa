import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const ensureUserOrg = vi.fn();
const getUserPrimaryOrganizationId = vi.fn();
const resolvePostAuthRedirectPath = vi.fn();
const resolveBlockingCalibrationPathForAdminOrg = vi.fn();
const resolveDestinationWithBlockingCalibration = vi.fn();
const recoverWorkspaceAccessGrantForAuthenticatedUser = vi.fn();
const recoverApprovedWorkspaceAccessRequestForAuthenticatedUser = vi.fn();
const recoverPendingOrganizationInviteForAuthenticatedUser = vi.fn();
const resolveApprovedAccessRequestWorkspaceName = vi.fn(
  (request: { company_name?: string | null; requester_name?: string | null }, fallback = "My Organization") => {
    const companyName = typeof request.company_name === "string" ? request.company_name.trim() : "";
    if (companyName) return companyName;
    const requesterName = typeof request.requester_name === "string" ? request.requester_name.trim() : "";
    return requesterName ? `${requesterName}'s Organization` : fallback;
  }
);
const updateUserById = vi.fn();
const adminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
    },
  })),
  createAdminClient: vi.fn(async () => ({
    from: adminFrom,
    auth: { admin: { updateUserById } },
  })),
  ensureUserOrg,
  resolveDefaultOrganizationNameForUser: vi.fn(() => "My Organization"),
}));

vi.mock("@/lib/access-review", () => ({
  recoverWorkspaceAccessGrantForAuthenticatedUser,
  recoverApprovedWorkspaceAccessRequestForAuthenticatedUser,
  resolveApprovedAccessRequestWorkspaceName,
}));

vi.mock("@/lib/auth/invite-recovery", () => ({
  recoverPendingOrganizationInviteForAuthenticatedUser,
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
    recoverWorkspaceAccessGrantForAuthenticatedUser.mockResolvedValue({
      ok: true,
      grant: {
        id: "grant_1",
        request_id: "request_1",
        normalized_email: "user@example.com",
        status: "used",
        expires_at: "2026-12-01T00:00:00.000Z",
        issued_by: "operator_1",
        used_by: "user_1",
        used_at: "2026-06-01T00:00:00.000Z",
        revoked_at: null,
        created_at: "2026-06-01T00:00:00.000Z",
      },
    });
    recoverApprovedWorkspaceAccessRequestForAuthenticatedUser.mockResolvedValue({
      ok: false,
      error: "request_not_recoverable",
    });
    recoverPendingOrganizationInviteForAuthenticatedUser.mockResolvedValue({
      ok: false,
      error: "invite_not_found",
    });
    updateUserById.mockResolvedValue({ data: { user: { id: "user_1" } }, error: null });
  });

  it("allows existing workspace members through non-invite callbacks", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));
    expect(ensureUserOrg).not.toHaveBeenCalled();
    expect(getUserPrimaryOrganizationId).toHaveBeenCalled();
    expect(resolvePostAuthRedirectPath).toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("rejects first-workspace callbacks without a consumed access grant", async () => {
    getUserPrimaryOrganizationId.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(ensureUserOrg).not.toHaveBeenCalled();
    expect(resolvePostAuthRedirectPath).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=access_grant_required");
  });

  it("provisions a first workspace only when the callback user owns the consumed access grant", async () => {
    const grantId = "00000000-0000-4000-8000-000000000010";
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          user_metadata: { access_grant_id: grantId },
        },
      },
      error: null,
    });
    getUserPrimaryOrganizationId.mockResolvedValueOnce(null).mockResolvedValueOnce("org_1");
    adminFrom.mockImplementation((table: string) => {
      expect(table).toBe("workspace_access_grants");
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: grantId,
            normalized_email: "user@example.com",
            status: "used",
            used_by: "user_1",
          },
          error: null,
        }),
      };
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(ensureUserOrg).toHaveBeenCalledWith("user_1", "My Organization", expect.anything());
    expect(resolvePostAuthRedirectPath).toHaveBeenCalledWith(expect.anything(), "org_1", "/dashboard");
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("recovers a first workspace when a confirmed callback user has an issued email-bound access grant", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          email_confirmed_at: "2026-06-01T00:00:00.000Z",
          user_metadata: {},
        },
      },
      error: null,
    });
    getUserPrimaryOrganizationId.mockResolvedValueOnce(null).mockResolvedValueOnce("org_1");
    adminFrom.mockImplementation((table: string) => {
      if (table === "workspace_access_requests") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { company_name: "Acme", requester_name: "Ada" },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(recoverWorkspaceAccessGrantForAuthenticatedUser).toHaveBeenCalledWith(expect.anything(), {
      email: "user@example.com",
      userId: "user_1",
    });
    expect(updateUserById).toHaveBeenCalledWith("user_1", {
      user_metadata: { access_grant_id: "grant_1" },
    });
    expect(ensureUserOrg).toHaveBeenCalledWith("user_1", "Acme", expect.anything());
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("recovers a first workspace when the callback user has confirmed_at without email_confirmed_at", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          confirmed_at: "2026-06-01T00:00:00.000Z",
          user_metadata: {},
        },
      },
      error: null,
    });
    getUserPrimaryOrganizationId.mockResolvedValueOnce(null).mockResolvedValueOnce("org_1");
    adminFrom.mockImplementation((table: string) => {
      if (table === "workspace_access_requests") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { company_name: "Acme", requester_name: "Ada" },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(recoverWorkspaceAccessGrantForAuthenticatedUser).toHaveBeenCalledWith(expect.anything(), {
      email: "user@example.com",
      userId: "user_1",
    });
    expect(ensureUserOrg).toHaveBeenCalledWith("user_1", "Acme", expect.anything());
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("recovers a first workspace when a confirmed callback user has an approved request and no grant row", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          email_confirmed_at: "2026-06-01T00:00:00.000Z",
          user_metadata: {},
        },
      },
      error: null,
    });
    getUserPrimaryOrganizationId.mockResolvedValueOnce(null).mockResolvedValueOnce("org_1");
    recoverWorkspaceAccessGrantForAuthenticatedUser.mockResolvedValueOnce({
      ok: false,
      error: "grant_not_recoverable",
    });
    recoverApprovedWorkspaceAccessRequestForAuthenticatedUser.mockResolvedValueOnce({
      ok: true,
      request: {
        id: "request_1",
        normalized_email: "user@example.com",
        requester_name: "Ada",
        company_name: "Acme",
        status: "approved",
      },
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(recoverApprovedWorkspaceAccessRequestForAuthenticatedUser).toHaveBeenCalledWith(expect.anything(), {
      email: "user@example.com",
    });
    expect(ensureUserOrg).toHaveBeenCalledWith("user_1", "Acme", expect.anything());
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("accepts a pending email-bound team invite when callback metadata was not preserved", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user_1",
          email: "user@example.com",
          email_confirmed_at: "2026-06-01T00:00:00.000Z",
          user_metadata: {},
        },
      },
      error: null,
    });
    getUserPrimaryOrganizationId.mockResolvedValueOnce(null);
    recoverWorkspaceAccessGrantForAuthenticatedUser.mockResolvedValueOnce({
      ok: false,
      error: "grant_not_recoverable",
    });
    recoverApprovedWorkspaceAccessRequestForAuthenticatedUser.mockResolvedValueOnce({
      ok: false,
      error: "request_not_recoverable",
    });
    recoverPendingOrganizationInviteForAuthenticatedUser.mockResolvedValueOnce({
      ok: true,
      organizationId: "org_1",
      role: "viewer",
      inviteId: "invite_1",
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(recoverPendingOrganizationInviteForAuthenticatedUser).toHaveBeenCalledWith(expect.anything(), {
      email: "user@example.com",
      userId: "user_1",
    });
    expect(ensureUserOrg).not.toHaveBeenCalled();
    expect(resolvePostAuthRedirectPath).toHaveBeenCalledWith(expect.anything(), "org_1", "/dashboard");
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

  it("rejects invite callbacks when accepting would exceed the workspace seat limit", async () => {
    const inviteId = "00000000-0000-4000-8000-000000000003";
    const memberUpsert = vi.fn();
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
      if (table === "organization_invites") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: inviteId,
              organization_id: "org_1",
              email: "user@example.com",
              role: "viewer",
              expires_at: new Date(Date.now() + 60_000).toISOString(),
              consumed_at: null,
              revoked_at: null,
            },
            error: null,
          }),
        };
      }
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: Array.from({ length: 10 }, (_, index) => ({
                user_id: `existing_user_${index}`,
              })),
              error: null,
            }),
          })),
          upsert: memberUpsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(ensureUserOrg).not.toHaveBeenCalled();
    expect(memberUpsert).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invite_seat_limit");
  });

  it("rolls back exact invite membership when invite consumption fails", async () => {
    const inviteId = "00000000-0000-4000-8000-000000000004";
    const memberUpsert = vi.fn(async () => ({ error: null }));
    const memberDeleteBuilder: { eq: ReturnType<typeof vi.fn> } = { eq: vi.fn() };
    memberDeleteBuilder.eq.mockImplementation(() => memberDeleteBuilder);
    const memberDelete = vi.fn(() => memberDeleteBuilder);

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
      if (table === "organization_invites") {
        const fetchBuilder = {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: inviteId,
              organization_id: "org_1",
              email: "user@example.com",
              role: "viewer",
              expires_at: new Date(Date.now() + 60_000).toISOString(),
              consumed_at: null,
              revoked_at: null,
            },
            error: null,
          }),
        };
        const consumeBuilder = {
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return {
          select: vi.fn(() => fetchBuilder),
          update: vi.fn(() => consumeBuilder),
        };
      }
      if (table === "organization_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          upsert: memberUpsert,
          delete: memberDelete,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost:3000/auth/callback?code=abc"));

    expect(memberUpsert).toHaveBeenCalledWith(
      {
        organization_id: "org_1",
        user_id: "user_1",
        role: "viewer",
      },
      { onConflict: "organization_id,user_id" }
    );
    expect(memberDelete).toHaveBeenCalled();
    expect(memberDeleteBuilder.eq).toHaveBeenCalledWith("organization_id", "org_1");
    expect(memberDeleteBuilder.eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=invite_invalid");
  });

  it("uses the trusted canonical origin when the callback request host is untrusted in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    vi.stubEnv("OBLIXA_TRUSTED_APP_ORIGINS", "https://app.example.com");
    exchangeCodeForSession.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad code" } });

    try {
      const { GET } = await import("@/app/auth/callback/route");
      const res = await GET(new Request("https://evil.example/auth/callback?code=abc"));
      expect(res.headers.get("location")).toBe("https://app.example.com/login?error=auth_callback_error");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
