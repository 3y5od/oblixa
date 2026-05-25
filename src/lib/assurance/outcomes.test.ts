import { describe, expect, it } from "vitest";
import { computeOutcomeViews } from "@/lib/assurance/outcomes";

function createOutcomeAdmin(result: { data: unknown[]; error: { message: string } | null; count?: number | null }) {
  const normalized = {
    data: result.data,
    error: result.error,
    count: result.count ?? null,
  };
  type OutcomeReadChain = {
    eq: () => OutcomeReadChain;
    order: () => OutcomeReadChain;
    limit: () => Promise<typeof normalized>;
  };
  const chain: OutcomeReadChain = {
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(normalized),
  };
  return {
    from() {
      return { select: () => chain };
    },
  };
}

describe("computeOutcomeViews", () => {
  it("marks the result incomplete when the analysis query is truncated", async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      id: `row-${index}`,
      intervention_type: "program_nudge",
      effectiveness_score: 80,
      analyzed_at: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      recurrence_delta: 0,
    }));
    const admin = createOutcomeAdmin({ data: rows, error: null, count: 700 });

    const result = await computeOutcomeViews(admin as never, "org-1");

    expect(result.error).toBeNull();
    expect(result.complete).toBe(false);
    expect(result.truncated).toBe(true);
    expect(result.scanned).toBe(500);
    expect(result.total).toBe(700);
  });
});