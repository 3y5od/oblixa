// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=quarantined_optional_pwa_sw
import { test } from "@playwright/test";

test("PWA service worker lifecycle", () => {
  test.skip(!process.env.RUN_PWA_SW_E2E, "Set RUN_PWA_SW_E2E=1 when service worker registers.");
});
