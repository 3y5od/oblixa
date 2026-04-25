import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §5.3 + §12 — Core mutations stay visible as blocked with shared copy when the role cannot edit.
 */
describe("V9 permission eligibility on work queue inline actions", () => {
  it("work page gates inline mutations with org role (canEditContracts)", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(page).toContain("canEditContracts");
    expect(page).toContain("workQueueMutationsEnabled");
    expect(page).toContain("mutationsEnabled={workQueueMutationsEnabled}");
  });

  it("inline actions render PermissionEligibilityHint when mutations are disabled", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/work/work-queue-inline-actions.tsx"),
      "utf8"
    );
    expect(src).toContain("PermissionEligibilityHint");
    expect(src).toContain('variant="not_permitted"');
    expect(src).toContain("mutationsEnabled === false");
  });
});
