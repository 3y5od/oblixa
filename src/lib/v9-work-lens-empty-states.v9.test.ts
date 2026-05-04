import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_WORK_HUB_LENS_VALUES } from "./work-hub-lens";

describe("V9 §12.2 + §20 work lens empty-state CTAs", () => {
  it("anchors per-lens recovery links in work page source", () => {
    const raw = [
      readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src/app/(dashboard)/work/work-page-helpers.ts"), "utf8"),
    ].join("\n");
    expect(raw).toContain("tasksEmptyLensAction");
    expect(raw).toContain("approvalsEmptyLensAction");
    expect(raw).toContain("obligationsEmptyLensAction");
    expect(raw).toContain("exceptionsEmptyLensAction");
    expect(raw).toContain("/contracts/renewals?horizon=renewal_30");
    expect(raw).toContain("/contracts/renewals?horizon=end_30");
    expect(raw).toContain("/contracts/exceptions?status=resolved");
    expect(V9_WORK_HUB_LENS_VALUES).toHaveLength(5);
  });
});
