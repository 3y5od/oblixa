import { describe, expect, it } from "vitest";
import {
  addDaysIsoDate,
  deriveWorkflowHealthScore,
  normalizeIsoDate,
  normalizeWorkflowText,
} from "@/lib/workflow/primitives";

describe("workflow primitives", () => {
  it("normalizes date strings to ISO date", () => {
    expect(normalizeIsoDate("2026-05-01")).toBe("2026-05-01");
    expect(normalizeIsoDate("bad-date")).toBeNull();
  });

  it("adds days to normalized dates", () => {
    expect(addDaysIsoDate("2026-05-01", 7)).toBe("2026-05-08");
  });

  it("normalizes text with max length", () => {
    expect(normalizeWorkflowText("  hello  ", 10)).toBe("hello");
    expect(normalizeWorkflowText("123456", 4)).toBe("1234");
  });

  it("derives at-risk when blockers exist", () => {
    expect(
      deriveWorkflowHealthScore({
        hasOwner: true,
        missingCriticalDates: false,
        overdueTasks: 0,
        overdueObligations: 0,
        pendingApprovals: 0,
        hasBlockers: true,
      })
    ).toBe("at_risk");
  });
});
