import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = join(process.cwd(), "src/actions/onboarding-calibration.ts");

describe("onboarding-calibration — no client-supplied organization_id", () => {
  it("does not read organization_id from FormData or action input payloads", () => {
    const raw = readFileSync(FILE, "utf8");
    expect(raw).not.toMatch(/formData\.get\(\s*["']organization_id["']\s*\)/);
    expect(raw).not.toMatch(/parsed\.data\.[a-zA-Z0-9_]*organization_id/);
    expect(raw).not.toMatch(/input\.organization_id/);
  });
});
