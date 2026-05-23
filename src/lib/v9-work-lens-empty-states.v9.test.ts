import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORK_EMPTY_STATE, WORK_TAB_LABELS } from "./work/spec-strings";

describe("Work release-state empty state", () => {
  it("anchors the exact empty copy and release-state tabs", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(raw).toContain("WORK_EMPTY_STATE");
    expect(WORK_EMPTY_STATE).toBe("Create work from a contract date, obligation, approval, or exception.");
    expect(Object.values(WORK_TAB_LABELS)).toEqual([
      "All",
      "My work",
      "Overdue",
      "Blocked",
      "Approvals",
      "Obligations",
      "Exceptions",
    ]);
  });
});
