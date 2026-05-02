// skip-meta-default: owner=@test-governance expiry=2027-12-31 reason=quarantined_optional_a11y_extensions
import { test } from "@playwright/test";

test.describe("a11y nightly extensions @a11y-nightly", () => {
  test("zoom 400% / touch targets / charts", () => {
    test.skip(!process.env.A11Y_NIGHTLY_EXTENSIONS, "Set A11Y_NIGHTLY_EXTENSIONS=1.");
  });
});
