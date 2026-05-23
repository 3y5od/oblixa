import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiAuthContext = vi.fn();
const canManageCapability = vi.fn();
const appendCasefileEvent = vi.fn();
const applyProgramToContract = vi.fn();

vi.mock("@/lib/v4/api-auth", () => ({
  getApiAuthContext,
  canManageCapability,
}));

vi.mock("@/lib/v4/casefile", () => ({
  appendCasefileEvent,
}));

vi.mock("@/lib/v4/execution-engine", () => ({
  applyProgramToContract,
}));

vi.mock("@/lib/product-surface/api-workspace-guard", () => ({
  requireApiWorkspaceEligibility: vi.fn(async () => null),
}));

function createAdminClientMock() {
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(async () => ({ data: [{ id: "contract-1" }], error: null })),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      upsert: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => {
        if (table === "contract_programs") {
          return {
            data: {
              id: "prog-1",
              organization_id: "org-1",
              name: "Q2 Program",
              current_version_id: "v1",
            },
            error: null,
          };
        }
        if (table === "contract_program_versions") {
          return { data: { id: "v1" }, error: null };
        }
        return { data: null, error: null };
      }),
    };
    return chain;
  });

  return { from };
}

describe("POST /api/programs/[id]/[action]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getApiAuthContext.mockResolvedValue({
      admin: createAdminClientMock(),
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
    });
    canManageCapability.mockResolvedValue(true);
  });

  it("rejects contractIds outside the caller organization", async () => {
    const { POST } = await import("@/app/api/programs/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/programs/prog-1/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractIds: ["contract-1", "foreign-contract"] }),
      }),
      { params: Promise.resolve({ id: "prog-1", action: "apply" }) }
    );

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      error: "Some contractIds are invalid for this organization",
      code: "invalid_contract_ids",
      details: { invalidContractIds: ["foreign-contract"] },
    });
    expect(applyProgramToContract).not.toHaveBeenCalled();
    expect(appendCasefileEvent).not.toHaveBeenCalled();
  });

  it("apply uses an idempotent assignment upsert scoped to contract and program", async () => {
    const upsert = vi.fn(() => ({
      select: vi.fn(async () => ({ data: [], error: null })),
    }));
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "contract_programs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "prog-1",
                      organization_id: "org-1",
                      name: "Q2 Program",
                      current_version_id: "v1",
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "contracts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(async () => ({ data: [{ id: "contract-1" }], error: null })),
              })),
            })),
          };
        }
        if (table === "contract_program_versions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: { id: "v1" }, error: null })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "contract_program_assignments") {
          return { upsert };
        }
        return {};
      }),
    };
    getApiAuthContext.mockResolvedValueOnce({
      admin,
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
    });

    const { POST } = await import("@/app/api/programs/[id]/[action]/route");
    const res = await POST(
      new Request("http://localhost:3000/api/programs/prog-1/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractIds: ["contract-1"] }),
      }),
      { params: Promise.resolve({ id: "prog-1", action: "apply" }) }
    );

    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          organization_id: "org-1",
          contract_id: "contract-1",
          program_id: "prog-1",
          program_version_id: "v1",
          assignment_mode: "manual",
          status: "active",
          assigned_by: "user-1",
        },
      ],
      {
        onConflict: "contract_id,program_id,status",
        ignoreDuplicates: false,
      }
    );
  });
});
