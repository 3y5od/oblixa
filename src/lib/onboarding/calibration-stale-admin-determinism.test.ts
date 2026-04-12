import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Plan B.3 — first admin for stale cron audits is deterministic (oldest membership row). */
describe("calibration stale cron admin resolution", () => {
  it("orders organization_members by created_at ascending before limit(1)", () => {
    const file = join(process.cwd(), "src/lib/onboarding/calibration-stale-run.ts");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain('.order("created_at", { ascending: true })');
    expect(raw).toContain('.eq("organization_id", orgId)');
    expect(raw).toContain('.eq("role", "admin")');
  });
});
