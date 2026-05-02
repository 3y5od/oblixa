// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=quarantined_optional_visual_cross_engine
import { test } from "@playwright/test";

test.describe("visual cross-engine @visual", () => {
  test("forced-colors / reduced-motion / dark matrix", () => {
    test.skip(!process.env.PLAYWRIGHT_VISUAL_CROSS, "Set PLAYWRIGHT_VISUAL_CROSS=1.");
  });
});
