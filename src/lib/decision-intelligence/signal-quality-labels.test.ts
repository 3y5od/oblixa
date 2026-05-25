import { describe, expect, it } from "vitest";
import {
  parseSignalQualityForDisplay,
  V5_SIGNAL_QUALITY_KEY_LABELS,
} from "@/lib/decision-intelligence/signal-quality-labels";

describe("parseSignalQualityForDisplay", () => {
  it("maps known keys to labels and sorts by label", () => {
    const rows = parseSignalQualityForDisplay({
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
    expect(parseSignalQualityForDisplay(null)).toEqual([]);
    expect(parseSignalQualityForDisplay([])).toEqual([]);
  });
});
