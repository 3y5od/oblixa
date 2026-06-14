import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORK_EMPTY_STATE, WORK_TAB_LABELS } from "./work/spec-strings";

describe("Work release-state empty state", () => {
  it("anchors the exact empty copy and release-state tabs", () => {
    const raw = [
      "src/app/(dashboard)/work/page.tsx",
      "src/app/(dashboard)/work/work-table.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
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
