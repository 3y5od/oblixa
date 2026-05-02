// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=quarantined_optional_canary_headers
import { test } from "@playwright/test";

test("staging canary routing headers", () => {
  test.skip(
    !process.env.STAGING_BASE_URL || !process.env.RUN_CANARY_HEADER_E2E,
    "Set STAGING_BASE_URL and RUN_CANARY_HEADER_E2E=1."
  );
});
