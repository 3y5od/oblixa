import { describe, expect, it, vi } from "vitest";
import {
  DECISION_CONTEXT_MAX_CONTRACTS,
  buildDecisionExecutionContext,
  normalizeLinkedContractIds,
} from "@/lib/decision-intelligence/decision-context";

const u1 = "11111111-1111-1111-1111-111111111111";
const u2 = "22222222-2222-2222-2222-222222222222";

describe("normalizeLinkedContractIds", () => {
  it("returns empty for non-array", () => {
    expect(normalizeLinkedContractIds(null)).toEqual({ ids: [], truncated: false });
    expect(normalizeLinkedContractIds({})).toEqual({ ids: [], truncated: false });
  });

  it("filters invalid UUID strings", () => {
    expect(normalizeLinkedContractIds([u1, "bad", u2]).ids).toEqual([u1, u2]);
  });

  it("caps at DECISION_CONTEXT_MAX_CONTRACTS and sets truncated", () => {
    const validMany = Array.from({ length: 30 }, (_, i) =>
      `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`
    );
    const r = normalizeLinkedContractIds(validMany);
    expect(r.ids.length).toBe(DECISION_CONTEXT_MAX_CONTRACTS);
    expect(r.truncated).toBe(true);
  });
});

describe("buildDecisionExecutionContext", () => {
  it("returns empty context when no valid ids", async () => {
    const admin = { from: vi.fn() };
    const ctx = await buildDecisionExecutionContext(admin as never, "org-1", []);
    expect(ctx.tasks).toEqual([]);
    expect(ctx.linkedContractIdsUsed).toEqual([]);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("queries with org filter when ids present", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const admin = { from: vi.fn(() => chain) };
    await buildDecisionExecutionContext(admin as never, "org-1", [u1]);
    expect(admin.from).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });
});
