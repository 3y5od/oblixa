import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/lib/rate-limit";

function keysFromFile(absPath: string): Set<string> {
  const raw = readFileSync(absPath, "utf8");
  const found = new Set<string>();
  for (const m of raw.matchAll(/RATE_LIMITS\.([a-zA-Z0-9_]+)/g)) {
    found.add(m[1]);
  }
  return found;
}

describe("onboarding calibration rate limit key parity", () => {
  it("every RATE_LIMITS.* reference in onboarding-calibration + calibration-gate exists on RATE_LIMITS", () => {
    const actionKeys = keysFromFile(join(process.cwd(), "src/actions/onboarding-calibration.ts"));
    const gateKeys = keysFromFile(join(process.cwd(), "src/lib/onboarding/calibration-gate.ts"));
    const merged = new Set([...actionKeys, ...gateKeys]);
    expect(merged.size).toBeGreaterThan(0);
    for (const k of merged) {
      expect(RATE_LIMITS, k).toHaveProperty(k);
    }
  });
});
