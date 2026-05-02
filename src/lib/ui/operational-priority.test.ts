import { describe, expect, it } from "vitest";
import {
  scoreOperationalPriority,
  sortOperationalPriority,
  summarizeOperationalCounts,
} from "./operational-priority";

describe("operational-priority", () => {
  it("scores failed and critical work above routine activity", () => {
    const sorted = sortOperationalPriority([
      { id: "recent", kind: "recent_activity", title: "Recent changes", count: 12 },
      { id: "due", kind: "work", title: "Due today", count: 3, dueState: "due_today" },
      { id: "report", kind: "failed_report", title: "Failed reports", count: 1, failed: true },
      { id: "exception", kind: "blocked", title: "Critical exception", count: 1, severity: "critical" },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["exception", "report", "due", "recent"]);
    expect(sorted[0].tone).toBe("risk");
  });

  it("keeps zero-value normal states quiet", () => {
    const item = scoreOperationalPriority({ id: "clear", kind: "work", title: "Due today", count: 0 });
    expect(item.active).toBe(false);
    expect(item.tone).toBe("healthy");
    expect(item.score).toBe(0);
  });

  it("summarizes all-clear and active states", () => {
    expect(
      summarizeOperationalCounts([
        { id: "due", kind: "work", title: "Due today", count: 0 },
        { id: "blocked", kind: "blocked", title: "Blocked", count: 0 },
      ]).isAllClear
    ).toBe(true);

    const active = summarizeOperationalCounts([
      { id: "blocked", kind: "blocked", title: "Blocked", count: 2, blocked: true },
    ]);
    expect(active.isAllClear).toBe(false);
    expect(active.attentionCount + active.riskCount).toBeGreaterThan(0);
  });
});
