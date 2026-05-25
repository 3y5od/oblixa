import { describe, expect, it } from "vitest";
import { mergeV5SignalQuality } from "@/lib/decision-intelligence/signal-quality-merge";

describe("mergeV5SignalQuality", () => {
  it("adds to existing numeric keys", () => {
    expect(mergeV5SignalQuality({ a: 2 }, { a: 3, b: 1 })).toEqual({ a: 5, b: 1 });
  });

  it("ignores non-finite deltas", () => {
    expect(mergeV5SignalQuality({}, { x: NaN as unknown as number })).toEqual({});
  });

  it("merges cron telemetry counters", () => {
    expect(
      mergeV5SignalQuality(
        { v5_campaign_progress_cron_updates: 2 },
        { v5_campaign_progress_cron_updates: 3, v5_capacity_forecast_cron_runs: 1 }
      )
    ).toEqual({
      v5_campaign_progress_cron_updates: 5,
      v5_capacity_forecast_cron_runs: 1,
    });
  });

  it("does not embed strings (PII-safe contract)", () => {
    const m = mergeV5SignalQuality({}, { recommendation_accepted: 1 });
    expect(Object.values(m).every((v) => typeof v === "number")).toBe(true);
  });
});
