/**
 * V9 Appendix AG — plan enforcement applies to create/edit mutations, not read-only navigation or Core home landing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("plan enforcement does not block dashboard read navigation (V9)", () => {
  it("dashboard shell layout has no plan gate imports", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/isPlanEnforcementEnabled|orgHasActivePlan/);
  });

  it("dashboard home page does not require an active subscription to render", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"), "utf8");
    expect(page).not.toMatch(/isPlanEnforcementEnabled|orgHasActivePlan/);
  });

  it("workspace product mode settings do not depend on billing subscription state", () => {
    const action = readFileSync(join(process.cwd(), "src/actions/product-surface-settings.ts"), "utf8");
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/settings/product/page.tsx"), "utf8");
    expect(action).not.toMatch(/orgHasActivePlan|isPlanEnforcementEnabled|validateWorkspaceModeBillingEligibility/);
    expect(page).not.toMatch(/eligible billing posture|active billing plan|Open Billing before saving this change/);
  });
});
