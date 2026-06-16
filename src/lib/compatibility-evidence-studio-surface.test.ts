import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_ACTION_LABELS,
  EVIDENCE_EMPTY_STATE,
  EVIDENCE_PAGE_LEAD,
  EVIDENCE_PAGE_TITLE,
  EVIDENCE_ROW_LABELS,
  EVIDENCE_SECTION_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "@/lib/evidence/spec-strings";

describe("Evidence release-state surface", () => {
  it("renders the Core Evidence workspace instead of the legacy studio", () => {
    const raw = [
      "src/app/(dashboard)/contracts/evidence-studio/page.tsx",
      "src/app/(dashboard)/contracts/evidence-studio/evidence-table.tsx",
      "src/app/(dashboard)/contracts/evidence-studio/evidence-table-row.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
    expect(raw.length).toBeGreaterThan(200);
    expect(raw).toContain("loadEvidencePageModel");
    expect(raw).toContain("EvidenceReleaseActions");
    expect(raw).toContain("EvidenceRequestCreatePanel");
    expect(raw).toContain('id="live-request-queue"');
    expect(raw).toContain("WorkspaceRequiredState");
    // Release-fit additions: a live filter bar + a semantic table shell.
    expect(raw).toContain("EvidenceFilterBar");
    expect(raw).toContain("<table");
    expect(raw).not.toContain("Evidence studio");
    expect(raw).not.toContain("Template starter");
    expect(raw).not.toContain("Saved templates");
    expect(raw).not.toContain("Jump to library");
    expect(raw).not.toContain("Reusable pattern");
  });

  it("ships an apply-live filter bar with a clear-filters reset", () => {
    const bar = readFileSync(
      join(process.cwd(), "src/components/evidence/evidence-filter-bar.tsx"),
      "utf8"
    );
    const sharedBar = readFileSync(
      join(process.cwd(), "src/components/ui/filter-bar.tsx"),
      "utf8"
    );
    // The clear-filters reset now lives in the shared FilterBar, wired by the
    // evidence bar's clearFiltersHref; the "Clear filters" affordance is in the
    // shared component (one Clear, not one per bar).
    expect(bar).toContain("FilterBar");
    expect(bar).toContain("clearFiltersHref");
    expect(sharedBar).toContain("Clear filters");
    expect(bar).toContain("buildEvidenceHref");
    // Apply-live: dropdowns navigate on change via the router, not a form submit.
    expect(bar).toContain("useRouter");
  });

  it("keeps release-state Evidence strings in the local spec module", () => {
    expect(EVIDENCE_PAGE_TITLE).toBe("Evidence");
    expect(EVIDENCE_PAGE_LEAD).toBe("Request, receive, and review proof tied to contract requirements and follow-up tasks.");
    expect(EVIDENCE_EMPTY_STATE).toBe(
      "Request evidence when a contract requirement or follow-up task needs proof."
    );
    expect(Object.values(EVIDENCE_SECTION_LABELS)).toEqual([
      "Open",
      "Overdue",
      "Received",
      "Linked requirements",
    ]);
    expect(Object.values(EVIDENCE_ROW_LABELS)).toEqual([
      "Request",
      "Linked contract",
      "Requirement",
      "Owner",
      "Due",
      "Status",
      "Files",
    ]);
    expect(Object.values(EVIDENCE_STATUS_LABELS)).toEqual([
      "Requested",
      "Received",
      "Overdue",
      "Accepted",
      "Rejected",
    ]);
    expect(Object.values(EVIDENCE_ACTION_LABELS)).toEqual([
      "Request evidence",
      "Upload evidence",
      "Accept",
      "Reject",
      "Send reminder",
    ]);
  });

  it("keeps evidence submission form module for upload compatibility", () => {
    expect(
      readFileSync(
        join(process.cwd(), "src/components/contracts/evidence-submission-form.tsx"),
        "utf8"
      ).length
    ).toBeGreaterThan(120);
  });
});
