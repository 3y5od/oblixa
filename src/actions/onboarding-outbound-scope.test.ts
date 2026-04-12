import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/onboarding.md §20 / plan §24.16 — calibration analytics use audit_events only, not outbound_events
 * (includes support export action in the same module).
 */
describe("onboarding-calibration outbound scope", () => {
  it("does not enqueue outbound integration events", () => {
    const path = join(__dirname, "onboarding-calibration.ts");
    const src = readFileSync(path, "utf8");
    expect(src.includes("enqueueOutboundEvent")).toBe(false);
  });
});
