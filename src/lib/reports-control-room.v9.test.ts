import { describe, expect, it } from "vitest";
import { buildReportsControlRoomSummary } from "./reports-control-room";

describe("reports control room summary (V9)", () => {
  it("surfaces failed report posture and partial export follow-through explicitly", () => {
    const summary = buildReportsControlRoomSummary({
      reportRuns: [
        { status: "failed", started_at: "2026-04-19T10:00:00.000Z" },
        { status: "running", started_at: "2026-04-19T09:00:00.000Z" },
        { status: "succeeded", started_at: "2026-04-18T09:00:00.000Z" },
      ],
      exportJobs: [
        {
          status: "partial",
          selected_contract_count: 12,
          exported_rows: 10,
          truncated: false,
          error_message: "Two rows were suppressed.",
        },
      ],
    });

    expect(summary.reportsNeedAttention).toBe(true);
    expect(summary.failedRunsCount).toBe(1);
    expect(summary.runningRunsCount).toBe(1);
    expect(summary.succeededRunsCount).toBe(1);
    expect(summary.latestFailedRunAt).toBe("2026-04-19T10:00:00.000Z");
    expect(summary.latestExportTone).toBe("attention");
    expect(summary.latestExportStateLabel).toBe("Export finished partially");
    expect(summary.latestExportHeadline).toMatch(/partial/i);
    expect(summary.latestExportDetail).toMatch(/retry/i);
  });

  it("falls back to neutral empty-state copy when no report runs or export jobs exist", () => {
    const summary = buildReportsControlRoomSummary({
      reportRuns: [],
      exportJobs: [],
    });

    expect(summary.reportsNeedAttention).toBe(false);
    expect(summary.failedRunsCount).toBe(0);
    expect(summary.runningRunsCount).toBe(0);
    expect(summary.succeededRunsCount).toBe(0);
    expect(summary.latestFailedRunAt).toBeNull();
    expect(summary.latestSucceededRunAt).toBeNull();
    expect(summary.latestExportTone).toBe("neutral");
    expect(summary.latestExportHeadline).toBe("No recent exports");
    expect(summary.latestExportStateLabel).toBe("No recent exports recorded");
  });
});
