import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildV10MutationResponse } from "@/lib/mutation-envelope";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const requireApiWorkspaceEligibility = vi.fn();
const getOrgSettingsJson = vi.fn();
const recordV10AuditEvent = vi.fn();
const refreshV10ReadModelsForOrganization = vi.fn();
const executeV10AuditedMutation = vi.fn(
  async (
    _admin: unknown,
    _input: unknown,
    executeTransaction: () => Promise<{ response: unknown; auditEventId: string | null; rollback?: (input: unknown) => Promise<void> }>
  ) => {
    const result = await executeTransaction();
    return { response: result.response, replayed: false };
  }
);

vi.mock("@/lib/contract-operations/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: (...args: unknown[]) => requireApiWorkspaceEligibility(...args),
}));

vi.mock("@/lib/assurance/org-settings", () => ({
  getOrgSettingsJson: (...args: unknown[]) => getOrgSettingsJson(...args),
}));

vi.mock("@/lib/server-contracts", () => ({
  executeV10AuditedMutation,
  getV10ExpectedVersionFromRequest: (request: Request) =>
    request.headers.get("x-v10-expected-version")?.trim() || request.headers.get("if-match")?.replace(/^"|"$/g, "").trim() || undefined,
  getV10IdempotencyKeyFromRequest: (request: Request) => request.headers.get("x-idempotency-key")?.trim() || null,
  recordV10AuditEvent,
}));

vi.mock("@/lib/read-model-refresh", () => ({
  refreshV10ReadModelsForOrganization,
}));

function adminMock(opts: {
  listError?: boolean;
  insertError?: boolean;
  listData?: Array<Record<string, unknown>>;
}) {
  const deletedIds: string[] = [];
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
        delete: vi.fn(() => ({
          eq: vi.fn((field: string, value: string) => {
            if (field === "id") deletedIds.push(value);
            return {
              eq: vi.fn(async () => ({ error: null })),
            };
          }),
        })),
      };
    }),
    deletedIds,
  };
}

describe("/api/report-packs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiWorkspaceEligibility.mockResolvedValue(null);
    getOrgSettingsJson.mockResolvedValue({ workspace_mode: "core" });
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

  it("POST rolls back the inserted report pack when audit persistence fails", async () => {
    const admin = adminMock({});
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
    recordV10AuditEvent.mockResolvedValueOnce(null);
    executeV10AuditedMutation.mockImplementationOnce(async (_admin, _input, executeTransaction) => {
      const result = await executeTransaction();
      if (!result.auditEventId) {
        await result.rollback?.({
          reason: "audit_write_failed",
          diagnosticId: "v10_audit_write_failed",
          targetType: "report_run",
          targetId: "pack-1",
        });
        return {
          response: buildV10MutationResponse({
            outcome: "audit_write_failed",
            message: "The change was not completed because an audit event could not be recorded.",
            changedObjectType: "report_run",
            changedObjectId: "pack-1",
            diagnosticId: "v10_audit_write_failed",
          }),
          replayed: false,
        };
      }
      return { response: result.response, replayed: false };
    });

    const { POST } = await import("@/app/api/report-packs/route");
    const res = await POST(
      new Request("http://localhost:3000/api/report-packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "report_pack_rollback_1" },
        body: JSON.stringify({ name: "Weekly health" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.outcome).toBe("audit_write_failed");
    expect(admin.deletedIds).toEqual(["pack-1"]);
    expect(refreshV10ReadModelsForOrganization).toHaveBeenCalledTimes(1);
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
