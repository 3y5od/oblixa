import { describe, expect, it } from "vitest";
import { clampProductTelemetryDetails } from "@/lib/product-telemetry";

describe("product telemetry scrub", () => {
  it("clips oversized string values", () => {
    const out = clampProductTelemetryDetails({
      ok: true,
      blob: "x".repeat(5000),
    });
    expect(String(out.blob).length).toBeLessThanOrEqual(800);
  });
});
