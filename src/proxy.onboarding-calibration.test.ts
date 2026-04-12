import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: proxy must tie redirects to calibration-gate and never send /api/cron (or other /api/*) through the calibration redirect.
 */
describe("proxy onboarding calibration wiring", () => {
  it("imports calibration gate and exempts /api paths from calibration redirect", () => {
    const file = join(process.cwd(), "src/proxy.ts");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain('from "@/lib/onboarding/calibration-gate"');
    expect(raw).toContain("resolveBlockingCalibrationPathForUserClient");
    expect(raw).toContain('!pathname.startsWith("/api/")');
    expect(raw).toContain('!pathname.startsWith("/onboarding/")');
    expect(raw).toContain('!pathname.startsWith("/auth/")');
    expect(raw).toContain('!pathname.startsWith("/external/")');
    expect(raw).toContain('!pathname.startsWith("/.well-known/")');
    expect("/api/cron/v6/onboarding-calibration-stale".startsWith("/api/")).toBe(true);
  });
});
