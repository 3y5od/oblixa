import { describe, expect, it } from "vitest";
import { CAPACITY_FORECAST_JSON_KEYS } from "@/lib/v5/capacity-forecast-keys";

describe("CAPACITY_FORECAST_JSON_KEYS", () => {
  it("has unique string values", () => {
    const vals = Object.values(CAPACITY_FORECAST_JSON_KEYS);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("keys match values for stable JSON shape contract", () => {
    for (const [k, v] of Object.entries(CAPACITY_FORECAST_JSON_KEYS)) {
      expect(k).toBe(v);
    }
  });
});
