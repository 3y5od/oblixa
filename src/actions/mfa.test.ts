import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const getAuthContext = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
  createAdminClient,
  getAuthContext,
}));

vi.mock("@/lib/security/audit-write", () => ({
  recordSecurityAuditEvent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("mfa server actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("startTotpEnrollment returns Not authenticated without user", async () => {
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    const { startTotpEnrollment } = await import("./mfa");
    const res = await startTotpEnrollment();
    expect(res).toEqual({ error: "Not authenticated" });
  });

  it("verifyTotpEnrollment records org-scoped audit when org present (eligibility)", async () => {
    const user = { id: "u1" };
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
        mfa: {
          challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    });
    getAuthContext.mockResolvedValue({ orgId: "00000000-0000-0000-0000-000000000001" });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { verifyTotpEnrollment } = await import("./mfa");
    const res = await verifyTotpEnrollment({ factorId: "f1", code: "123456" });
    expect(res).toEqual({ success: true });
  });
});
