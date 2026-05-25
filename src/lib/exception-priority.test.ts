import { describe, expect, it } from "vitest";
import { compareExceptionsByPriority, severityRank } from "./exception-priority";

describe("exception priority helpers (v9)", () => {
  it("keeps actionable exceptions ahead of resolved ones", () => {
    const ordered = [
      {
        status: "resolved",
        severity: "critical",
        due_date: "2026-04-01",
        updated_at: "2026-04-10T00:00:00.000Z",
      },
      {
        status: "open",
        severity: "medium",
        due_date: "2026-04-12",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
    ].sort(compareExceptionsByPriority);

    expect(ordered[0]?.status).toBe("open");
  });

  it("sorts actionable exceptions by severity before due date", () => {
    const ordered = [
      {
        status: "open",
        severity: "medium",
        due_date: "2026-04-01",
        updated_at: "2026-04-10T00:00:00.000Z",
      },
      {
        status: "open",
        severity: "critical",
        due_date: "2026-04-20",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
    ].sort(compareExceptionsByPriority);

    expect(ordered[0]?.severity).toBe("critical");
    expect(severityRank("critical")).toBeLessThan(severityRank("medium"));
  });
});
