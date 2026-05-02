import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const getV6OrgSettingsJson = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const executeV10AuditedMutation = vi.fn(
  async (
    _admin: unknown,
    _input: unknown,
    executeTransaction: () => Promise<{ response: unknown; auditEventId: string | null }>
  ) => {
    const result = await executeTransaction();
    return { response: result.response, replayed: false };
  }
);

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/v6/org-settings", () => ({
  getV6OrgSettingsJson: (...args: unknown[]) => getV6OrgSettingsJson(...args),
}));

vi.mock("@/lib/v10-server-contracts", () => ({
  executeV10AuditedMutation,
  getV10ExpectedVersionFromRequest: (request: Request) =>
    request.headers.get("x-v10-expected-version")?.trim() || request.headers.get("if-match")?.replace(/^"|"$/g, "").trim() || undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  recordV10AuditEvent,
}));

vi.mock("@/lib/v10-read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

function adminMock(opts: {
  listError?: boolean;
  insertError?: boolean;
  listData?: Array<Record<string, unknown>>;
}) {
  const listRows =
    opts.listData ??
    [
      {
        id: "p1",
        name: "A",
        description: null,
        report_type: "weekly_execution_health",
        schedule: null,
        active: true,
        updated_at: null,
      },
    ];
  return {
    from: vi.fn((table: string) => {
      if (table !== "report_packs") {
        return {};
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () =>
              opts.listError
                ? { data: null, error: { message: "list failed" } }
                : {
                    data: listRows,
                    error: null,
                  }
            ),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () =>
              opts.insertError
                ? { data: null, error: { message: "insert failed" } }
                : {
                    data: {
                      id: "pack-1",
                      name: "Weekly",
                      report_type: "weekly_execution_health",
                      schedule: null,
                      active: true,
                    },
                    error: null,
                  }
            ),
          })),
        })),
      };
    }),
  };
}

describe("/api/report-packs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    getV6OrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
    recordV10AuditEvent.mockResolvedValue("v10-audit-1");
    refreshV10ReadModelsForOrganization.mockResolvedValue({ ok: true, counts: {} });
    executeV10AuditedMutation.mockClear();
    getApiAuthContext.mockResolvedValue({
      admin: adminMock({}),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("GET returns 401 when unauthenticated", async () => {
    getApiAuthContext.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/report-packs/route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("GET returns report packs for org", async () => {
    const { GET } = await import("@/app/api/report-packs/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reportPacks).toHaveLength(1);
    expect(body.reportPacks[0].id).toBe("p1");
  });

  it("GET omits report packs whose type is ineligible for Core mode", async () => {
    getApiAuthContext.mockResolvedValueOnce({
      admin: adminMock({
        listData: [
          {
            id: "p1",
            name: "Core",
            description: null,
            report_type: "weekly_execution_health",
            schedule: null,
            active: true,
            updated_at: null,
          },
          {
            id: "p2",
            name: "Adv",
            description: null,
            report_type: "decision_queue_summary",
            schedule: null,
            active: true,
            updated_at: null,
          },
        ],
      }),
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    const { GET } = await import("@/app/api/report-packs/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reportPacks).toHaveLength(1);
    expect(body.reportPacks[0].id).toBe("p1");
  });

  it("POST returns 403 without capability", async () => {
    canManageCapability.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "N" }),
      })
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("POST returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("POST creates report pack", async () => {
    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "report_pack_12345" },
        body: JSON.stringify({ name: "Weekly health" }),
      })
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-V10-Idempotent-Replay")).toBe("false");
    const body = await res.json();
    expect(body.reportPack.id).toBe("pack-1");
    expect(executeV10AuditedMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mutationName: "report_pack.create",
        targetType: "report_run",
        targetId: "pending:report_pack_12345",
        auditAction: "report_run.created",
      }),
      expect.any(Function)
    );
  });

  it("POST returns a V10 mode_required envelope for report type ineligible in Core mode", async () => {
    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Adv pack", reportType: "decision_queue_summary" }),
      })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      outcome: "mode_required",
      diagnostic_id: "v10_report_pack_workspace_mode_required",
    });
  });
});
