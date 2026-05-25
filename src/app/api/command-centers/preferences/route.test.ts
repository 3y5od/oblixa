import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const recordApiMutationAuditEvent = vi.fn();

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility,
}));

vi.mock("@/lib/security/api-mutation-audit", () => ({
  recordApiMutationAuditEvent,
}));

describe("/api/command-centers/preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    recordApiMutationAuditEvent.mockResolvedValue("audit-1");
  });

  it("GET returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/command-centers/preferences/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/command-centers/preferences/route");
    const res = await POST(new Request("http://localhost/api/command-centers/preferences"));
    expect(res.status).toBe(401);
  });

  it("POST uses an idempotent role-scoped upsert instead of insert", async () => {
    const upsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "pref-1",
            role: "admin",
            preferences_json: { compact: true },
            updated_at: "2026-01-01T00:00:00Z",
          },
          error: null,
        })),
      })),
    }));
    const insert = vi.fn();
    const admin = {
      from: vi.fn((table: string) => {
        expect(table).toBe("role_command_center_preferences");
        return { upsert, insert };
      }),
    };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      orgId: "org-1",
      userId: "user-1",
      role: "admin",
    });

    const { POST } = await import("@/app/api/command-centers/preferences/route");
    const res = await POST(
      new Request("http://localhost/api/command-centers/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferences: { compact: true } }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.preferences.id).toBe("pref-1");
    expect(upsert).toHaveBeenCalledWith(
      {
        organization_id: "org-1",
        user_id: "user-1",
        role: "admin",
        preferences_json: { compact: true },
      },
      {
        onConflict: "organization_id,user_id,role",
        ignoreDuplicates: false,
      }
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
