import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE_ONBOARDING_SOURCES = [
  "src/components/dashboard/onboarding-banner.tsx",
  "src/components/dashboard/onboarding-banner.ui.test.tsx",
];

describe("V9 §5.4 / §20.3 Core onboarding copy guard", () => {
  it("does not embed Advanced/Assurance marketing phrases in onboarding banner sources", () => {
    for (const rel of CORE_ONBOARDING_SOURCES) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw.toLowerCase()).not.toContain("assurance mode");
      expect(raw.toLowerCase()).not.toContain("upgrade to assurance");
    }
  });
});
