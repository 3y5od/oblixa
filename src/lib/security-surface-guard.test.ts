import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 security guardrails (static)", () => {
  it("export contracts route keeps workspace eligibility gate", () => {
    const src = readFileSync(join(process.cwd(), "src/app/api/export/contracts/route.ts"), "utf8");
    expect(src).toContain("requireApiWorkspaceEligibility");
    expect(src).toContain("rateLimitCheck");
  });
});
