import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: stale cron and shared minimal path must scope service-role queries by org id.
 */
describe("onboarding calibration stale org scope (static)", () => {
  it("calibration-stale-run scopes organization_members and organizations by org id", () => {
    const file = join(process.cwd(), "src/lib/onboarding/calibration-stale-run.ts");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain('.eq("organization_id", orgId)');
    expect(raw).toContain('.eq("id", orgId)');
    expect(raw).toMatch(/organization_id:\s*orgId/);
  });

  it("calibration-blocking-minimal passes orgId into merge and audit rows", () => {
    const file = join(process.cwd(), "src/lib/onboarding/calibration-blocking-minimal.ts");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain("mergeOrgSettingsJson(admin, orgId,");
    expect(raw).toMatch(/organization_id:\s*orgId/);
  });
});
