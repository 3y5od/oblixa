import { describe, expect, it } from "vitest";
import { decisionQueueSlaFields } from "@/lib/decision-intelligence/decision-queue-sla";

describe("decisionQueueSlaFields", () => {
  it("returns no_due_date when dueAt is null", () => {
    expect(decisionQueueSlaFields(null)).toEqual({
      sla_status: "no_due_date",
      days_until_due: null,
      priority: "unspecified",
    });
  });

  it("marks overdue when due date is in the past", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const r = decisionQueueSlaFields(past);
    expect(r.sla_status).toBe("overdue");
    expect(r.priority).toBe("high");
    expect(r.days_until_due).toBeLessThan(0);
  });
});
