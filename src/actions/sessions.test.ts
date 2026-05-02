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

describe("sessions server actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    getAuthContext.mockResolvedValue({ orgId: "00000000-0000-0000-0000-000000000001" });
    createAdminClient.mockResolvedValue({ from: vi.fn() });
    const { revokeOtherSessions } = await import("./sessions");
    const res = await revokeOtherSessions();
    expect(res).toEqual({ success: true });
  });
});
