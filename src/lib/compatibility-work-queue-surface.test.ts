import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORK_ACTION_LABELS, WORK_EMPTY_STATE, WORK_FILTER_LABELS, WORK_TAB_LABELS } from "./work/spec-strings";

describe("Work release-state surface", () => {
  it("renders the release-state Work page structure", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(page).toContain("title={WORK_PAGE_TITLE}");
    expect(page).toContain("eyebrow={model.eyebrow}");
    expect(page).toContain("model.primaryCta");
    expect(page).toContain("Task table views");
    expect(page).toContain("WorkReleaseActions");
    expect(page).toContain("loadWorkPageModel");
    expect(page).toContain("Clear filters");
    expect(page).toContain("display.identity");
  });

  it("keeps exact release-state tabs, filters, row actions, and empty copy in spec strings", () => {
    expect(Object.values(WORK_TAB_LABELS)).toEqual([
      "All active",
      "Assigned to me",
      "Past due",
      "Cannot proceed",
      "Approvals",
      "Contract requirements",
      "Problems to resolve",
    ]);
    expect(Object.values(WORK_FILTER_LABELS)).toEqual([
      "Owner",
      "Due",
      "Contract",
      "Status",
      "Type",
    ]);
    expect(Object.values(WORK_ACTION_LABELS)).toEqual([
      "Complete",
      "Reassign",
      "Change due date",
      "Comment",
      "Link evidence",
    ]);
    expect(WORK_EMPTY_STATE).toBe("Create a task for a contract date, requirement, approval, problem, or evidence request.");
  });

  it("does not reintroduce old Work hub decoration or source diagnostics", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(page).not.toContain("Execution backlog");
    expect(page).not.toContain("Work queue");
    expect(page).not.toContain("Source queue diagnostics");
    expect(page).not.toContain("Sample work item");
    expect(page).not.toContain("landing-corner-ring");
    expect(page).not.toContain("DiagnosticDisclosure");
    expect(page).not.toContain("SamplePreviewCard");
    expect(page).not.toContain("QueueItemCard");
    // The release-state table keeps a sticky-header scroll container that uses
    // `overflow-x-auto` (required by page.surface.test.ts). The old Work hub's
    // anti-pattern was a hard min-width forcing the whole table to scroll —
    // guarded by `min-w-[980px]` below — not `overflow-x-auto` itself.
    expect(page).not.toContain("min-w-[980px]");
  });
});
