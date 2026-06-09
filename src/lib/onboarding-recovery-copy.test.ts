import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("onboarding first-run recovery copy anchors", () => {
  it("keeps explicit recovery CTAs for failed import and failed suggestions on the dashboard banner", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/dashboard/onboarding-banner.tsx"),
      "utf8"
    );
    expect(raw).toContain("Recover failed import");
    expect(raw).toContain("Recover failed suggestions");
    expect(raw).toContain("recoverableImportIssue");
    expect(raw).toContain("failedExtractionContractId");
  });
});
