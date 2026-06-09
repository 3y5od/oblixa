import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORK_EMPTY_STATE, WORK_TAB_LABELS } from "./work/spec-strings";

describe("Work release-state empty state", () => {
  it("anchors the exact empty copy and release-state tabs", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(raw).toContain("WORK_EMPTY_STATE");
    expect(WORK_EMPTY_STATE).toBe("Create a task for a contract date, requirement, approval, problem, or evidence request.");
    expect(Object.values(WORK_TAB_LABELS)).toEqual([
      "All active",
      "Assigned to me",
      "Past due",
      "Cannot proceed",
      "Approvals",
      "Contract requirements",
      "Problems to resolve",
    ]);
  });
});
