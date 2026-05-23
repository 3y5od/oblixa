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
    const raw = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/evidence-studio/page.tsx"),
      "utf8"
    );
    expect(raw.length).toBeGreaterThan(200);
    expect(raw).toContain("loadEvidencePageModel");
    expect(raw).toContain("EvidenceReleaseActions");
    expect(raw).toContain("EvidenceRequestCreatePanel");
    expect(raw).toContain('id="live-request-queue"');
    expect(raw).toContain("WorkspaceRequiredState");
    expect(raw).not.toContain("Evidence studio");
    expect(raw).not.toContain("Template starter");
    expect(raw).not.toContain("Saved templates");
    expect(raw).not.toContain("Jump to library");
    expect(raw).not.toContain("Reusable pattern");
  });

  it("keeps release-state Evidence strings in the local spec module", () => {
    expect(EVIDENCE_PAGE_TITLE).toBe("Evidence");
    expect(EVIDENCE_PAGE_LEAD).toBe("Track proof that contract work was completed.");
    expect(EVIDENCE_EMPTY_STATE).toBe(
      "Request evidence when a contract obligation needs proof of completion."
    );
    expect(Object.values(EVIDENCE_SECTION_LABELS)).toEqual([
      "Open requests",
      "Overdue requests",
      "Received evidence",
      "Evidence linked to obligations",
    ]);
    expect(Object.values(EVIDENCE_ROW_LABELS)).toEqual([
      "Request title",
      "Linked contract",
      "Linked obligation",
      "Request owner",
      "Due date",
      "Status",
      "Attached files",
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
