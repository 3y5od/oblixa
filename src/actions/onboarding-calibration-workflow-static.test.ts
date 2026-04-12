import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = join(process.cwd(), "src/actions/onboarding-calibration.ts");

describe("onboarding-calibration — workflow / notification writes (§24.11)", () => {
  it("does not call organization_workflow_settings directly (policy upsert lives in workspace-transition helpers)", () => {
    const raw = readFileSync(FILE, "utf8");
    expect(raw.includes("organization_workflow_settings")).toBe(false);
  });
});
