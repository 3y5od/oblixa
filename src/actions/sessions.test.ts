import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getAuthContext = vi.fn();
const hasSensitiveActionProof = vi.fn();
const recordSecurityAuditEvent = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getAuthContext,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent,
}));

vi.mock("@/lib/security/sensitive-action-proof", () => ({
  hasSensitiveActionProof,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

describe("sessions server actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    hasSensitiveActionProof.mockResolvedValue(true);
  });

  it("listMySessions returns Not authenticated without session", async () => {
    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    });
    const { listMySessions } = await import("./sessions");
    const res = await listMySessions();
    expect(res).toEqual({ error: "Not authenticated" });
  });

  it("revokeOtherSessions audits with organization_id when org present (eligibility)", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
        mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    getAuthContext.mockResolvedValue({ orgId: "00000000-0000-0000-0000-000000000001" });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { revokeOtherSessions } = await import("./sessions");
    const res = await revokeOtherSessions();
    expect(res).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/security");
  });

  it("revokeOtherSessions requires step-up or AAL2 before sign-out", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    hasSensitiveActionProof.mockResolvedValue(false);
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
        mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
        signOut,
      },
    });
    getAuthContext.mockResolvedValue({ orgId: "00000000-0000-0000-0000-000000000001" });
    createAdminClient.mockResolvedValue({ from: vi.fn() });

    const { revokeOtherSessions } = await import("./sessions");
    const res = await revokeOtherSessions();

    expect(res).toEqual({
      error: "Confirm your password or complete MFA before revoking other sessions.",
      needStepUp: true,
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(recordSecurityAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "security.sessions_revoke_others",
        outcome: "forbidden",
        safeMetadata: { reason: "sensitive_action_proof_required" },
      })
    );
  });
});
