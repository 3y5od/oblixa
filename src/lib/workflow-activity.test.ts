import { describe, expect, it } from "vitest";
import {
  buildUnifiedWorkflowTimeline,
  toWorkflowActivityFromEvents,
  toWorkflowActivityFromRenewalNotes,
} from "@/lib/workflow-activity";

describe("workflow-activity", () => {
  it("normalizes domain events into shared workflow activity rows", () => {
    const rows = toWorkflowActivityFromEvents("task", [
      { id: "evt-1", event_type: "status_changed", created_at: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(rows).toEqual([
      {
        id: "task-evt-1",
        domain: "task",
        label: "status changed",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("normalizes renewal notes into shared workflow activity rows", () => {
    const rows = toWorkflowActivityFromRenewalNotes([
      { id: "note-1", pinned: true, created_at: "2026-01-02T00:00:00.000Z" },
    ]);
    expect(rows[0]?.label).toBe("pinned note");
    expect(rows[0]?.domain).toBe("renewal");
  });

  it("builds a descending timeline across domains", () => {
    const rows = buildUnifiedWorkflowTimeline(
      {
        taskEvents: [{ id: "1", event_type: "created", created_at: "2026-01-01T00:00:00.000Z" }],
        obligationEvents: [{ id: "2", event_type: "fulfilled", created_at: "2026-02-01T00:00:00.000Z" }],
        approvalEvents: [{ id: "3", event_type: "approved", created_at: "2026-03-01T00:00:00.000Z" }],
        renewalNotes: [{ id: "4", pinned: false, created_at: "2026-04-01T00:00:00.000Z" }],
      },
      3
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]?.domain).toBe("renewal");
    expect(rows[1]?.domain).toBe("approval");
    expect(rows[2]?.domain).toBe("obligation");
  });

  it("drops malformed timestamps from the unified timeline", () => {
    const rows = buildUnifiedWorkflowTimeline({
      taskEvents: [{ id: "1", event_type: "created", created_at: "not-a-date" }],
      obligationEvents: [],
      approvalEvents: [],
      renewalNotes: [{ id: "2", pinned: false, created_at: "2026-04-01T00:00:00.000Z" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("renewal-note-2");
  });

  it("uses deterministic tie-breaking for identical timestamps", () => {
    const rows = buildUnifiedWorkflowTimeline({
      taskEvents: [
        { id: "b", event_type: "created", created_at: "2026-04-01T00:00:00.000Z" },
        { id: "a", event_type: "created", created_at: "2026-04-01T00:00:00.000Z" },
      ],
      obligationEvents: [],
      approvalEvents: [],
      renewalNotes: [],
    });
    expect(rows.map((row) => row.id)).toEqual(["task-a", "task-b"]);
  });
});
