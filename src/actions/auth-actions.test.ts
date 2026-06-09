import { describe, expect, it, vi, beforeEach } from "vitest";

type AuthErrorLike = { message: string; status?: number; name?: string };
type AccessGrantMockRow = {
  id: string;
  request_id: string;
  normalized_email: string;
  status: "issued" | "used";
  expires_at: string;
  issued_by: string;
  used_by: string | null;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};
type AccessGrantValidationResult =
  | { ok: true; grant: AccessGrantMockRow }
  | { ok: false; error: string };
type ApprovedAccessRequestRecoveryResult =
  | {
      ok: true;
      request: {
        id: string;
        normalized_email: string;
        requester_name: string | null;
        company_name: string | null;
        status: "approved";
      };
    }
  | { ok: false; error: string };
type OrganizationInviteRecoveryResult =
  | { ok: true; organizationId: string; role: "admin" | "editor" | "viewer"; inviteId: string }
  | { ok: false; error: string };

const rlMocks = vi.hoisted(() => ({
  rateLimitCheck: vi.fn(),
  getClientIpFromHeaders: vi.fn(async () => "127.0.0.1"),
}));

const adminTableMocks = vi.hoisted(() => {
  const grantRollbackBuilder: { eq: ReturnType<typeof vi.fn> } = {
    eq: vi.fn(),
  };
  grantRollbackBuilder.eq.mockImplementation(() => grantRollbackBuilder);
  const workspaceGrantUpdate = vi.fn(() => grantRollbackBuilder);
  const from = vi.fn((table: string) => {
    if (table === "workspace_access_grants") return { update: workspaceGrantUpdate };
    throw new Error(`Unexpected table ${table}`);
  });
  return { from, grantRollbackBuilder, workspaceGrantUpdate };
});

const authServerMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(async (): Promise<{
    data: {
      user: {
        id: string;
        email?: string;
        email_confirmed_at?: string | null;
        confirmed_at?: string | null;
        user_metadata?: Record<string, unknown>;
      } | null;
      session: { access_token: string } | null;
    };
    error: AuthErrorLike | null;
  }> => ({
    data: { user: { id: "user-1" }, session: { access_token: "token" } },
    error: null as AuthErrorLike | null,
  })),
  createUser: vi.fn(async (): Promise<{
    data: {
      user: {
        id: string;
        email?: string;
        email_confirmed_at?: string | null;
        confirmed_at?: string | null;
        user_metadata?: Record<string, unknown>;
      } | null;
    };
    error: AuthErrorLike | null;
  }> => ({
    data: {
      user: {
        id: "user-1",
        email: "a@b.co",
        user_metadata: { full_name: "Test", company_name: "Acme" },
      },
    },
    error: null as AuthErrorLike | null,
  })),
  updateUserById: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
  deleteUser: vi.fn(async () => ({ data: {}, error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  updateUser: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  createAdminClient: vi.fn(async (): Promise<unknown> => ({
    from: adminTableMocks.from,
    auth: {
      admin: {
        createUser: authServerMocks.createUser,
        updateUserById: authServerMocks.updateUserById,
        deleteUser: authServerMocks.deleteUser,
      },
    },
  })),
  getOrEnsureDeterministicMembership: vi.fn(async (): Promise<{
    organization_id: string;
    role: "admin";
  } | null> => ({
    organization_id: "org-1",
    role: "admin" as const,
  })),
  resolveDefaultOrganizationNameForUser: vi.fn((user: { user_metadata?: Record<string, unknown> | null }) => {
    const companyName = typeof user.user_metadata?.company_name === "string" ? user.user_metadata.company_name : "";
    if (companyName.trim()) return companyName.trim();
    const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
    return fullName.trim() ? `${fullName.trim()}'s Organization` : "My Organization";
  }),
  ensureUserOrg: vi.fn(async () => undefined),
}));

const calGateMocks = vi.hoisted(() => ({
  resolveBlockingCalibrationPathForAdminOrg: vi.fn(async () => null as string | null),
}));

const accessReviewMocks = vi.hoisted(() => ({
  validateWorkspaceAccessGrant: vi.fn(async (): Promise<AccessGrantValidationResult> => ({
    ok: true as const,
    grant: {
      id: "grant-1",
      request_id: "request-1",
      normalized_email: "a@b.co",
      status: "issued" as const,
      expires_at: "2099-01-01T00:00:00.000Z",
      issued_by: "operator-1",
      used_by: null,
      used_at: null,
      revoked_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  })),
  validateConsumedWorkspaceAccessGrantForUser: vi.fn(async (): Promise<AccessGrantValidationResult> => ({
    ok: true as const,
    grant: {
      id: "grant-1",
      request_id: "request-1",
      normalized_email: "a@b.co",
      status: "used" as const,
      expires_at: "2099-01-01T00:00:00.000Z",
      issued_by: "operator-1",
      used_by: "user-1",
      used_at: "2026-01-01T00:00:00.000Z",
      revoked_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  })),
  recoverWorkspaceAccessGrantForAuthenticatedUser: vi.fn(async (): Promise<AccessGrantValidationResult> => ({
    ok: true as const,
    grant: {
      id: "grant-1",
      request_id: "request-1",
      normalized_email: "a@b.co",
      status: "used" as const,
      expires_at: "2099-01-01T00:00:00.000Z",
      issued_by: "operator-1",
      used_by: "user-1",
      used_at: "2026-01-01T00:00:00.000Z",
      revoked_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  })),
  recoverApprovedWorkspaceAccessRequestForAuthenticatedUser: vi.fn(async (): Promise<ApprovedAccessRequestRecoveryResult> => ({
    ok: false as const,
    error: "request_not_recoverable",
  })),
  resolveApprovedAccessRequestWorkspaceName: vi.fn((request: { company_name?: string | null; requester_name?: string | null }, fallback = "My Organization") => {
    const companyName = typeof request.company_name === "string" ? request.company_name.trim() : "";
    if (companyName) return companyName;
    const requesterName = typeof request.requester_name === "string" ? request.requester_name.trim() : "";
    return requesterName ? `${requesterName}'s Organization` : fallback;
  }),
  markWorkspaceAccessGrantUsed: vi.fn(async () => ({ ok: true as const })),
}));

const inviteRecoveryMocks = vi.hoisted(() => ({
  recoverPendingOrganizationInviteForAuthenticatedUser: vi.fn(async (): Promise<OrganizationInviteRecoveryResult> => ({
    ok: false as const,
    error: "invite_not_found",
  })),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimitCheck: rlMocks.rateLimitCheck,
    getClientIpFromHeaders: rlMocks.getClientIpFromHeaders,
  };
});

vi.mock("@/lib/onboarding/calibration-gate", () => ({
  resolveBlockingCalibrationPathForAdminOrg: calGateMocks.resolveBlockingCalibrationPathForAdminOrg,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: authServerMocks.signInWithPassword,
      resetPasswordForEmail: authServerMocks.resetPasswordForEmail,
      getUser: authServerMocks.getUser,
      updateUser: authServerMocks.updateUser,
      signOut: authServerMocks.signOut,
    },
  })),
  createAdminClient: authServerMocks.createAdminClient,
  getOrEnsureDeterministicMembership: authServerMocks.getOrEnsureDeterministicMembership,
  resolveDefaultOrganizationNameForUser: authServerMocks.resolveDefaultOrganizationNameForUser,
  ensureUserOrg: authServerMocks.ensureUserOrg,
}));

vi.mock("@/lib/app-url", () => ({
  resolveAppBaseUrl: vi.fn(async () => "http://localhost:3000"),
}));

vi.mock("@/lib/access-review", () => ({
  validateWorkspaceAccessGrant: accessReviewMocks.validateWorkspaceAccessGrant,
  validateConsumedWorkspaceAccessGrantForUser: accessReviewMocks.validateConsumedWorkspaceAccessGrantForUser,
  recoverWorkspaceAccessGrantForAuthenticatedUser: accessReviewMocks.recoverWorkspaceAccessGrantForAuthenticatedUser,
  recoverApprovedWorkspaceAccessRequestForAuthenticatedUser:
    accessReviewMocks.recoverApprovedWorkspaceAccessRequestForAuthenticatedUser,
  resolveApprovedAccessRequestWorkspaceName: accessReviewMocks.resolveApprovedAccessRequestWorkspaceName,
  markWorkspaceAccessGrantUsed: accessReviewMocks.markWorkspaceAccessGrantUsed,
}));

vi.mock("@/lib/auth/invite-recovery", () => ({
  recoverPendingOrganizationInviteForAuthenticatedUser:
    inviteRecoveryMocks.recoverPendingOrganizationInviteForAuthenticatedUser,
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

describe("auth actions rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    rlMocks.rateLimitCheck.mockResolvedValue({ ok: false, retryAfterMs: 60_000 });
    calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue(null);
    accessReviewMocks.validateWorkspaceAccessGrant.mockResolvedValue({
      ok: true,
      grant: {
        id: "grant-1",
        request_id: "request-1",
        normalized_email: "a@b.co",
        status: "issued",
        expires_at: "2099-01-01T00:00:00.000Z",
        issued_by: "operator-1",
        used_by: null,
        used_at: null,
        revoked_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
    accessReviewMocks.validateConsumedWorkspaceAccessGrantForUser.mockResolvedValue({
      ok: true,
      grant: {
        id: "grant-1",
        request_id: "request-1",
        normalized_email: "a@b.co",
        status: "used",
        expires_at: "2099-01-01T00:00:00.000Z",
        issued_by: "operator-1",
        used_by: "user-1",
        used_at: "2026-01-01T00:00:00.000Z",
        revoked_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
    accessReviewMocks.recoverWorkspaceAccessGrantForAuthenticatedUser.mockResolvedValue({
      ok: true,
      grant: {
        id: "grant-1",
        request_id: "request-1",
        normalized_email: "a@b.co",
        status: "used",
        expires_at: "2099-01-01T00:00:00.000Z",
        issued_by: "operator-1",
        used_by: "user-1",
        used_at: "2026-01-01T00:00:00.000Z",
        revoked_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
    accessReviewMocks.markWorkspaceAccessGrantUsed.mockResolvedValue({ ok: true });
    inviteRecoveryMocks.recoverPendingOrganizationInviteForAuthenticatedUser.mockResolvedValue({
      ok: false,
      error: "invite_not_found",
    });
    authServerMocks.createUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "a@b.co",
          user_metadata: { full_name: "Test", company_name: "Acme" },
        },
      },
      error: null,
    });
    authServerMocks.deleteUser.mockResolvedValue({ data: {}, error: null });
    authServerMocks.updateUserById.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    adminTableMocks.from.mockClear();
    adminTableMocks.workspaceGrantUpdate.mockClear();
    adminTableMocks.grantRollbackBuilder.eq.mockClear();
  });

  it("signIn returns error when rate limited", async () => {
    const { signIn } = await import("@/actions/auth");
    const fd = new FormData();
    fd.set("email", "a@b.co");
    fd.set("password", "secret");
    const res = await signIn(fd);
    expect(res).toEqual({
      error: "Too many sign-in attempts. Try again in a few minutes.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("signUp returns error when rate limited", async () => {
    const { signUp } = await import("@/actions/auth");
    const fd = new FormData();
    fd.set("email", "a@b.co");
    fd.set("password", "secret");
    fd.set("fullName", "T");
    const res = await signUp(fd);
    expect(res).toEqual({
      error: "Too many sign-up attempts. Try again later.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("forgotPassword returns error when rate limited", async () => {
    const { forgotPassword } = await import("@/actions/auth");
    const fd = new FormData();
    fd.set("email", "recover@example.com");
    const res = await forgotPassword(fd);
    expect(res).toEqual({
      error: "Too many reset requests. Try again later.",
    });
  });

  describe("signIn input validation", () => {
    beforeEach(() => {
      rlMocks.rateLimitCheck.mockResolvedValue({ ok: true });
    });

    it("returns error for missing email", async () => {
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("password", "secret123");
      const res = await signIn(fd);
      expect(res).toEqual({ error: "Please enter a valid email address." });
    });

    it("returns error for email without @", async () => {
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "not-an-email");
      fd.set("password", "secret123");
      const res = await signIn(fd);
      expect(res).toEqual({ error: "Please enter a valid email address." });
    });

    it("returns error for unsafe email text before password sign-in", async () => {
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "user@example.com\u202Ehidden");
      fd.set("password", "secret123");
      const res = await signIn(fd);
      expect(res).toEqual({ error: "Please enter a valid email address." });
      expect(authServerMocks.signInWithPassword).not.toHaveBeenCalled();
    });

  });

  describe("signUp input validation", () => {
    beforeEach(() => {
      rlMocks.rateLimitCheck.mockResolvedValue({ ok: true });
    });

    it("returns error for missing email", async () => {
      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("password", "longpassword123");
      fd.set("fullName", "Test");
      const res = await signUp(fd);
      expect(res).toEqual({ error: "Please enter a valid email address." });
    });

    it("returns error for short password", async () => {
      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "short");
      fd.set("fullName", "Test");
      const res = await signUp(fd);
      expect(res).toEqual({
        error: "Password must be between 8 and 128 characters.",
      });
    });

    it("returns error for overly long name", async () => {
      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "longpassword123");
      fd.set("fullName", "A".repeat(201));
      const res = await signUp(fd);
      expect(res).toEqual({ error: "Name is too long." });
    });

    it("returns error for unsafe display names before sign-up", async () => {
      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "longpassword123");
      fd.set("fullName", "Ada\u202Ehidden");
      const res = await signUp(fd);
      expect(res).toEqual({ error: "Name contains unsupported characters." });
      expect(authServerMocks.createUser).not.toHaveBeenCalled();
    });

    it("denies signup without an approved access grant before calling Supabase signup", async () => {
      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "longpassword123");
      fd.set("fullName", "Test");
      const res = await signUp(fd);
      expect(res).toEqual({
        error:
          "Signup requires approved workspace access. Request access if your team tracks what signed contracts require next.",
      });
      expect(accessReviewMocks.validateWorkspaceAccessGrant).not.toHaveBeenCalled();
      expect(authServerMocks.createUser).not.toHaveBeenCalled();
    });

    it("validates, consumes, and provisions a workspace access grant when signup succeeds", async () => {
      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "longpassword123");
      fd.set("fullName", "Test");
      fd.set("companyName", "Acme");
      fd.set("accessCode", "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz");
      const res = await signUp(fd);

      expect(accessReviewMocks.validateWorkspaceAccessGrant).toHaveBeenCalledWith(expect.anything(), {
        token: "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz",
        email: "a@b.co",
      });
      expect(authServerMocks.createUser).toHaveBeenCalledWith({
        email: "a@b.co",
        password: "longpassword123",
        email_confirm: true,
        user_metadata: expect.objectContaining({ access_grant_id: "grant-1" }),
      });
      expect(authServerMocks.updateUserById).toHaveBeenCalledWith("user-1", {
        user_metadata: expect.objectContaining({ access_grant_id: "grant-1" }),
      });
      expect(accessReviewMocks.markWorkspaceAccessGrantUsed).toHaveBeenCalledWith(expect.anything(), {
        grantId: "grant-1",
        userId: "user-1",
      });
      expect(authServerMocks.ensureUserOrg).toHaveBeenCalledWith("user-1", "Acme", expect.anything());
      expect(authServerMocks.signInWithPassword).toHaveBeenCalledWith({
        email: "a@b.co",
        password: "longpassword123",
      });
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("uses a valid grant to provision an existing account with no workspace", async () => {
      authServerMocks.createUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "User already registered" },
      });
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            user_metadata: { full_name: "Ada" },
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" })
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" });

      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "longpassword123");
      fd.set("fullName", "Ada");
      fd.set("companyName", "Acme");
      fd.set("accessCode", "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz");

      const res = await signUp(fd);

      expect(authServerMocks.signInWithPassword).toHaveBeenCalledWith({
        email: "a@b.co",
        password: "longpassword123",
      });
      expect(accessReviewMocks.markWorkspaceAccessGrantUsed).toHaveBeenCalledWith(expect.anything(), {
        grantId: "grant-1",
        userId: "user-1",
      });
      expect(authServerMocks.ensureUserOrg).toHaveBeenCalledWith("user-1", "Acme", expect.anything());
      expect(authServerMocks.signOut).not.toHaveBeenCalled();
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("recovers an orphaned existing account when the same user owns the consumed grant", async () => {
      accessReviewMocks.validateWorkspaceAccessGrant.mockResolvedValueOnce({
        ok: false,
        error: "grant_used",
      });
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            user_metadata: { full_name: "Ada" },
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" })
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" });

      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "longpassword123");
      fd.set("fullName", "Ada");
      fd.set("companyName", "Acme");
      fd.set("accessCode", "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz");

      const res = await signUp(fd);

      expect(accessReviewMocks.validateConsumedWorkspaceAccessGrantForUser).toHaveBeenCalledWith(expect.anything(), {
        token: "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz",
        email: "a@b.co",
        userId: "user-1",
      });
      expect(authServerMocks.updateUserById).toHaveBeenCalledWith("user-1", {
        user_metadata: expect.objectContaining({ access_grant_id: "grant-1" }),
      });
      expect(authServerMocks.ensureUserOrg).toHaveBeenCalledWith("user-1", "Acme", expect.anything());
      expect(accessReviewMocks.markWorkspaceAccessGrantUsed).not.toHaveBeenCalled();
      expect(authServerMocks.signOut).not.toHaveBeenCalled();
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("does not sign in a new approved user when workspace provisioning cannot be verified", async () => {
      authServerMocks.getOrEnsureDeterministicMembership.mockResolvedValueOnce(null);

      const { signUp } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "longpassword123");
      fd.set("fullName", "Ada");
      fd.set("companyName", "Acme");
      fd.set("accessCode", "valid_access_grant_token_abcdefghijklmnopqrstuvwxyz");

      const res = await signUp(fd);

      expect(accessReviewMocks.markWorkspaceAccessGrantUsed).toHaveBeenCalledWith(expect.anything(), {
        grantId: "grant-1",
        userId: "user-1",
      });
      expect(adminTableMocks.from).toHaveBeenCalledWith("workspace_access_grants");
      expect(adminTableMocks.workspaceGrantUpdate).toHaveBeenCalledWith({
        status: "issued",
        used_by: null,
        used_at: null,
      });
      expect(adminTableMocks.grantRollbackBuilder.eq).toHaveBeenCalledWith("id", "grant-1");
      expect(adminTableMocks.grantRollbackBuilder.eq).toHaveBeenCalledWith("status", "used");
      expect(adminTableMocks.grantRollbackBuilder.eq).toHaveBeenCalledWith("used_by", "user-1");
      expect(authServerMocks.deleteUser).toHaveBeenCalledWith("user-1");
      expect(authServerMocks.signInWithPassword).not.toHaveBeenCalled();
      expect(res).toEqual({ error: "Account setup failed. Please try again." });
    });
  });

  describe("signIn blocking calibration redirect", () => {
    beforeEach(() => {
      rlMocks.rateLimitCheck.mockResolvedValue({ ok: true });
    });

    it("returns redirectTo /dashboard when resolveBlockingCalibrationPathForAdminOrg returns null", async () => {
      calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue(null);
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);
      expect(res).toEqual({ redirectTo: "/dashboard" });
      expect(rlMocks.rateLimitCheck).toHaveBeenCalledWith(
        "signin:127.0.0.1",
        expect.any(Object),
        { backendFailureMode: "memory-fallback", timeoutMs: 1500 }
      );
      expect(authServerMocks.getUser).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("signs out and returns a workspace access error when the account has no workspace membership", async () => {
      authServerMocks.getOrEnsureDeterministicMembership.mockResolvedValueOnce(null);
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);
      expect(res).toEqual({
        error: "No workspace is linked to this account. Request access or ask an admin for an invite.",
      });
      expect(authServerMocks.signOut).toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("creates the first workspace on login when a confirmed account owns a consumed access grant", async () => {
      const grantId = "00000000-0000-4000-8000-000000000010";
      const admin = {
        auth: {
          admin: {
            createUser: authServerMocks.createUser,
            updateUserById: authServerMocks.updateUserById,
            deleteUser: authServerMocks.deleteUser,
          },
        },
        from: vi.fn((table: string) => {
          expect(table).toBe("workspace_access_grants");
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(async () => ({
              data: {
                id: grantId,
                normalized_email: "a@b.co",
                status: "used",
                used_by: "user-1",
              },
              error: null,
            })),
          };
        }),
      };
      authServerMocks.createAdminClient.mockResolvedValueOnce(admin);
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            user_metadata: { access_grant_id: grantId, company_name: "Acme" },
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" });

      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);

      expect(authServerMocks.ensureUserOrg).toHaveBeenCalledWith("user-1", "Acme", admin);
      expect(authServerMocks.signOut).not.toHaveBeenCalled();
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("creates the first workspace on login when a confirmed account has an issued email-bound access grant", async () => {
      const admin = {
        auth: {
          admin: {
            createUser: authServerMocks.createUser,
            updateUserById: authServerMocks.updateUserById,
            deleteUser: authServerMocks.deleteUser,
          },
        },
        from: vi.fn((table: string) => {
          if (table === "workspace_access_requests") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn(async () => ({
                data: { company_name: "Acme", requester_name: "Ada" },
                error: null,
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };
      authServerMocks.createAdminClient.mockResolvedValueOnce(admin);
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            user_metadata: {},
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" })
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" });

      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);

      expect(accessReviewMocks.recoverWorkspaceAccessGrantForAuthenticatedUser).toHaveBeenCalledWith(admin, {
        email: "a@b.co",
        userId: "user-1",
      });
      expect(authServerMocks.updateUserById).toHaveBeenCalledWith("user-1", {
        user_metadata: { access_grant_id: "grant-1" },
      });
      expect(authServerMocks.ensureUserOrg).toHaveBeenCalledWith("user-1", "Acme", admin);
      expect(authServerMocks.signOut).not.toHaveBeenCalled();
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("creates the first workspace on login when Supabase returns confirmed_at without email_confirmed_at", async () => {
      const admin = {
        auth: {
          admin: {
            createUser: authServerMocks.createUser,
            updateUserById: authServerMocks.updateUserById,
            deleteUser: authServerMocks.deleteUser,
          },
        },
        from: vi.fn((table: string) => {
          if (table === "workspace_access_requests") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn(async () => ({
                data: { company_name: "Acme", requester_name: "Ada" },
                error: null,
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };
      authServerMocks.createAdminClient.mockResolvedValueOnce(admin);
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            confirmed_at: "2026-01-01T00:00:00.000Z",
            user_metadata: {},
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" })
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" });

      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);

      expect(accessReviewMocks.recoverWorkspaceAccessGrantForAuthenticatedUser).toHaveBeenCalledWith(admin, {
        email: "a@b.co",
        userId: "user-1",
      });
      expect(authServerMocks.ensureUserOrg).toHaveBeenCalledWith("user-1", "Acme", admin);
      expect(authServerMocks.signOut).not.toHaveBeenCalled();
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("creates the first workspace on login from an approved request when no grant row exists", async () => {
      const admin = {
        auth: {
          admin: {
            createUser: authServerMocks.createUser,
            updateUserById: authServerMocks.updateUserById,
            deleteUser: authServerMocks.deleteUser,
          },
        },
      };
      authServerMocks.createAdminClient.mockResolvedValueOnce(admin);
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            user_metadata: {},
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" })
        .mockResolvedValueOnce({ organization_id: "org-1", role: "admin" });
      accessReviewMocks.recoverWorkspaceAccessGrantForAuthenticatedUser.mockResolvedValueOnce({
        ok: false,
        error: "grant_not_recoverable",
      });
      accessReviewMocks.recoverApprovedWorkspaceAccessRequestForAuthenticatedUser.mockResolvedValueOnce({
        ok: true,
        request: {
          id: "request-1",
          normalized_email: "a@b.co",
          requester_name: "Ada",
          company_name: "Acme",
          status: "approved",
        },
      });

      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);

      expect(accessReviewMocks.recoverApprovedWorkspaceAccessRequestForAuthenticatedUser).toHaveBeenCalledWith(admin, {
        email: "a@b.co",
      });
      expect(authServerMocks.ensureUserOrg).toHaveBeenCalledWith("user-1", "Acme", admin);
      expect(authServerMocks.signOut).not.toHaveBeenCalled();
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("accepts a pending email-bound team invite on login when callback recovery was missed", async () => {
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            user_metadata: {},
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership.mockResolvedValueOnce(null);
      accessReviewMocks.recoverWorkspaceAccessGrantForAuthenticatedUser.mockResolvedValueOnce({
        ok: false,
        error: "grant_not_recoverable",
      });
      accessReviewMocks.recoverApprovedWorkspaceAccessRequestForAuthenticatedUser.mockResolvedValueOnce({
        ok: false,
        error: "request_not_recoverable",
      });
      inviteRecoveryMocks.recoverPendingOrganizationInviteForAuthenticatedUser.mockResolvedValueOnce({
        ok: true,
        organizationId: "org-1",
        role: "editor",
        inviteId: "invite-1",
      });

      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);

      expect(inviteRecoveryMocks.recoverPendingOrganizationInviteForAuthenticatedUser).toHaveBeenCalledWith(
        expect.anything(),
        {
          email: "a@b.co",
          userId: "user-1",
        }
      );
      expect(authServerMocks.signOut).not.toHaveBeenCalled();
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("does not create a first workspace from an email-bound grant when the account is unconfirmed", async () => {
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "a@b.co",
            email_confirmed_at: null,
            confirmed_at: null,
            user_metadata: {},
          },
          session: { access_token: "token" },
        },
        error: null,
      });
      authServerMocks.getOrEnsureDeterministicMembership.mockResolvedValueOnce(null);

      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);

      expect(accessReviewMocks.recoverWorkspaceAccessGrantForAuthenticatedUser).not.toHaveBeenCalled();
      expect(inviteRecoveryMocks.recoverPendingOrganizationInviteForAuthenticatedUser).not.toHaveBeenCalled();
      expect(authServerMocks.ensureUserOrg).not.toHaveBeenCalled();
      expect(authServerMocks.signOut).toHaveBeenCalled();
      expect(res).toEqual({
        error: "No workspace is linked to this account. Request access or ask an admin for an invite.",
      });
    });

    it("resetPassword signs out and returns a workspace access error when no workspace is linked", async () => {
      authServerMocks.getOrEnsureDeterministicMembership.mockResolvedValueOnce(null);
      const { resetPassword } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("password", "longpassword123");
      const res = await resetPassword(fd);
      expect(res).toEqual({
        error: "No workspace is linked to this account. Request access or ask an admin for an invite.",
      });
      expect(authServerMocks.signOut).toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns redirectTo /onboarding/calibration when the gate returns that path", async () => {
      calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue("/onboarding/calibration");
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);
      expect(res).toEqual({ redirectTo: "/onboarding/calibration" });
      expect(authServerMocks.getUser).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("returns a clear retry message when Supabase auth is temporarily unavailable", async () => {
      authServerMocks.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "{}", status: 522, name: "AuthRetryableFetchError" },
      });
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);
      expect(res).toEqual({
        error: "Authentication is temporarily unavailable. Try again in a few minutes.",
      });
      expect(authServerMocks.getUser).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("keeps sign-in successful when post-auth redirect resolution throws", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      authServerMocks.getOrEnsureDeterministicMembership.mockRejectedValueOnce(new Error("audit_events insert failed"));
      const { signIn } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "a@b.co");
      fd.set("password", "secret");
      const res = await signIn(fd);
      expect(res).toEqual({ redirectTo: "/dashboard" });
      expect(redirect).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("forgotPassword recovery flow", () => {
    beforeEach(() => {
      rlMocks.rateLimitCheck.mockResolvedValue({ ok: true });
    });

    it("forgotPassword requests a reset link using the reset-password route", async () => {
      const { forgotPassword } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("email", "recover@example.com");
      const res = await forgotPassword(fd);
      expect(authServerMocks.resetPasswordForEmail).toHaveBeenCalledWith("recover@example.com", {
        redirectTo: "http://localhost:3000/reset-password",
      });
      expect(res).toEqual({ success: "Check your email for a password reset link." });
    });
  });

  describe("resetPassword redirect resolution", () => {
    beforeEach(() => {
      rlMocks.rateLimitCheck.mockResolvedValue({ ok: true });
      calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue(null);
    });

    it("resetPassword rejects too-short replacement passwords before calling updateUser", async () => {
      const { resetPassword } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("password", "short");
      const res = await resetPassword(fd);
      expect(res).toEqual({ error: "Password must be between 8 and 128 characters." });
      expect(authServerMocks.updateUser).not.toHaveBeenCalled();
    });

    it("resetPassword rejects unsafe replacement passwords before calling updateUser", async () => {
      const { resetPassword } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("password", "longpassword123\u202Ehidden");
      const res = await resetPassword(fd);
      expect(res).toEqual({ error: "Password contains unsupported characters." });
      expect(authServerMocks.updateUser).not.toHaveBeenCalled();
    });

    it("returns redirectTo /dashboard when no blocking calibration is needed", async () => {
      const { resetPassword } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("password", "longpassword123");
      const res = await resetPassword(fd);
      expect(authServerMocks.updateUser).toHaveBeenCalledWith({ password: "longpassword123" });
      expect(res).toEqual({ redirectTo: "/dashboard" });
    });

    it("returns redirectTo /onboarding/calibration when the gate requires it", async () => {
      calGateMocks.resolveBlockingCalibrationPathForAdminOrg.mockResolvedValue("/onboarding/calibration");
      const { resetPassword } = await import("@/actions/auth");
      const fd = new FormData();
      fd.set("password", "longpassword123");
      const res = await resetPassword(fd);
      expect(res).toEqual({ redirectTo: "/onboarding/calibration" });
    });
  });
});
