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
    expect(body).toEqual({
      error: "Some contractIds are invalid for this organization",
      invalidContractIds: ["foreign-contract"],
    });
    expect(applyProgramToContract).not.toHaveBeenCalled();
    expect(appendCasefileEvent).not.toHaveBeenCalled();
  });
});
