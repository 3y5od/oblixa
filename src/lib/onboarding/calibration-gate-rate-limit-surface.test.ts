import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Plan C.5–C.6 — gate paths throttle after auth context exists (user id keyed). */
describe("calibration-gate rate limit surface (static)", () => {
  it("applies rateLimitCheck to admin-org and user-client paths", () => {
    const file = join(process.cwd(), "src/lib/onboarding/calibration-gate.ts");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain("resolveBlockingCalibrationPathForAdminOrg");
    expect(raw).toContain('`onboarding-calibration:gate-admin:${userId}:${orgId}`');
    expect(raw).toContain("resolveBlockingCalibrationPathForUserClient");
    expect(raw).toContain('`onboarding-calibration:gate:${user.id}`');
    expect(raw).toContain("rateLimitCheck");
  });
});
