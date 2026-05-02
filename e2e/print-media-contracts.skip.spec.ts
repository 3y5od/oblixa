// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=quarantined_optional_print_media
import { test } from "@playwright/test";

test("print CSS contracts/reports", () => {
  test.skip(!process.env.RUN_PRINT_MEDIA_E2E, "Set RUN_PRINT_MEDIA_E2E=1 for page.pdf print emulation.");
});
