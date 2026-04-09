import { describe, expect, it } from "vitest";
import {
  parseV5SignalQualityForDisplay,
  V5_SIGNAL_QUALITY_KEY_LABELS,
} from "@/lib/v5/v5-signal-quality-labels";

describe("parseV5SignalQualityForDisplay", () => {
  it("maps known keys to labels and sorts by label", () => {
    const rows = parseV5SignalQualityForDisplay({
      v5_recommendation_accepted: 2,
      v5_decisions_closed: 1,
    });
    expect(rows.map((r) => r.label)).toEqual([
      V5_SIGNAL_QUALITY_KEY_LABELS.v5_decisions_closed,
      V5_SIGNAL_QUALITY_KEY_LABELS.v5_recommendation_accepted,
    ]);
    expect(rows[0].value).toBe(1);
    expect(rows[1].value).toBe(2);
  });

  it("returns empty for non-objects", () => {
    expect(parseV5SignalQualityForDisplay(null)).toEqual([]);
    expect(parseV5SignalQualityForDisplay([])).toEqual([]);
  });
});
