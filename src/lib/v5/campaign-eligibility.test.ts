import { describe, expect, it, vi } from "vitest";
import {
  CAMPAIGN_TASK_MARKER,
  contractIdsMatchingEligibility,
  countContractsMatchingEligibility,
} from "@/lib/v5/campaign-eligibility";

function mockQueryBuilder(result: { data: unknown; error: unknown }) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  b.select = vi.fn().mockReturnValue(b);
  b.eq = vi.fn().mockReturnValue(b);
  b.in = vi.fn().mockReturnValue(b);
  b.limit = vi.fn().mockResolvedValue(result);
  return b;
}

describe("campaign-eligibility", () => {
  it("CAMPAIGN_TASK_MARKER includes campaign id", () => {
    expect(CAMPAIGN_TASK_MARKER("c1")).toContain("c1");
  });

  it("contractIdsMatchingEligibility returns [] when no eligibility keys", async () => {
    const admin = { from: vi.fn() };
    await expect(
      contractIdsMatchingEligibility(admin as never, "org-1", {})
    ).resolves.toEqual([]);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("contractIdsMatchingEligibility returns [] on program assignment error", async () => {
    const assigns = mockQueryBuilder({ data: null, error: { message: "fail" } });
    const admin = {
      from: vi.fn((t: string) => (t === "contract_program_assignments" ? assigns : mockQueryBuilder({ data: [], error: null }))),
    };
    await expect(
      contractIdsMatchingEligibility(admin as never, "org-1", { programId: "p1" })
    ).resolves.toEqual([]);
  });

  it("contractIdsMatchingEligibility filters by status when provided", async () => {
    const contracts = mockQueryBuilder({
      data: [{ id: "cid-1" }],
      error: null,
    });
    const admin = { from: vi.fn(() => contracts) };
    const ids = await contractIdsMatchingEligibility(admin as never, "org-1", {
      status: "active",
    });
    expect(ids).toEqual(["cid-1"]);
    expect(contracts.eq).toHaveBeenCalledWith("status", "active");
  });

  it("countContractsMatchingEligibility returns array length", async () => {
    const contracts = mockQueryBuilder({
      data: [{ id: "a" }, { id: "b" }],
      error: null,
    });
    const admin = { from: vi.fn(() => contracts) };
    await expect(
      countContractsMatchingEligibility(admin as never, "org-1", { status: "pending_review" })
    ).resolves.toBe(2);
  });
});
