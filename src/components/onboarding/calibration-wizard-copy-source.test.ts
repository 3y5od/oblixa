import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Plan E — wizard user-visible strings come from calibration-copy (single source). */
describe("calibration-wizard copy source", () => {
  it("imports user-facing strings from calibration-copy", () => {
    const file = join(process.cwd(), "src/components/onboarding/calibration-wizard.tsx");
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain('from "@/lib/onboarding/calibration-copy"');
    expect(raw).toContain("calibrationFlowTitle");
    expect(raw).toContain("stepLabels");
    expect(raw).toContain("reviewSectionHeadings");
    expect(raw).toContain("calibrationReviewTestIds");
    expect(raw).toContain("labelForSearchScope");
    expect(raw).toContain("reviewUtilitiesNoneHidden");
  });
});
