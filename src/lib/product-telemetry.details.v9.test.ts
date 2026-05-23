import { describe, expect, it } from "vitest";
import {
  PRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES,
  clampProductTelemetryDetails,
} from "./product-telemetry";

describe("product telemetry details clamp", () => {
  it("keeps small payloads intact", () => {
    expect(clampProductTelemetryDetails({ a: "x", b: 2 })).toEqual({ a: "x", b: 2 });
  });

  it("never exceeds max JSON bytes", () => {
    const huge = "Z".repeat(50_000);
    const out = clampProductTelemetryDetails({ huge, n: 1 });
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(PRODUCT_TELEMETRY_DETAILS_MAX_JSON_BYTES + 200);
  });

  it("redacts email-like patterns from string detail values (§5.3 + §28)", () => {
    const out = clampProductTelemetryDetails({ surface: "notify ops@corp.test" });
    expect(out.surface).toBe("notify [redacted]");
  });

  it("strips sensitive query values before telemetry persistence", () => {
    const out = clampProductTelemetryDetails({ href: "/settings?token=secret&tab=billing" });
    expect(out.href).toBe("/settings?tab=billing");
  });
});
