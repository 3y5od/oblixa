import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("settings product governance UI markers", () => {
  it("renders downgrade confirmation and canonical notification controls", () => {
    const raw = [
      readFileSync(join(process.cwd(), "src/app/(dashboard)/settings/product/page.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src/app/(dashboard)/settings/product/settings-product-email-section.tsx"), "utf8"),
    ].join("\n");
    expect(raw).toContain("confirm_scheduled_report_downgrade");
    expect(raw).toContain("Confirm scheduled report suppression on downgrade");
    expect(raw).toContain("NOTIFICATION_TAXONOMY");
    expect(raw).toContain("notification_policy_json.email.blocked_types");
  });
});