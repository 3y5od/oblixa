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
    expect(page).toContain("UiTabs");
    expect(page).toContain("WorkReleaseActions");
    expect(page).toContain("loadWorkPageModel");
    expect(page).toContain("Clear filters");
    expect(page).toContain("display.identity");
  });

  it("keeps exact release-state tabs, filters, row actions, and empty copy in spec strings", () => {
    expect(Object.values(WORK_TAB_LABELS)).toEqual([
      "All",
      "My work",
      "Overdue",
      "Blocked",
      "Approvals",
      "Obligations",
      "Exceptions",
    ]);
    expect(Object.values(WORK_FILTER_LABELS)).toEqual([
      "Owner",
      "Due date",
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
      "Escalate",
    ]);
    expect(WORK_EMPTY_STATE).toBe("Create work from a contract date, obligation, approval, or exception.");
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
    expect(page).not.toContain("overflow-x-auto");
    expect(page).not.toContain("min-w-[980px]");
  });
});
