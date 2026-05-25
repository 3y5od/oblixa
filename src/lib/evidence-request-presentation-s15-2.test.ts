import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * v9 spec §15.2 — what, why, linked-to, who, due/overdue, current status
 * for each evidence requirement row.
 */
describe("V9 §15.2 evidence request presentation (ContractEvidenceRequirementsPanel)", () => {
  const panel = readFileSync(
    join(process.cwd(), "src/components/contracts/contract-evidence-requirements-panel.tsx"),
    "utf8"
  );

  it("renders what is needed (title) and current status in the summary line", () => {
    expect(panel).toContain("{r.title}");
    expect(panel).toContain("{r.status}");
  });

  it("explains why it is needed", () => {
    expect(panel).toContain("Why it matters:");
  });

  it("states what the request is linked to (work item)", () => {
    expect(panel).toContain("linked");
    expect(panel).toContain("work_item");
  });

  it("names who should provide or review next", () => {
    expect(panel).toContain("Who should act next:");
    expect(panel).toContain("nextActorLabel");
  });

  it("shows due or review-by dates when present", () => {
    expect(panel).toContain("due ");
    expect(panel).toContain("review by");
  });

  it("surfaces current status with distinct copy for required / submitted / rejected", () => {
    expect(panel).toContain("required");
    expect(panel).toContain("submitted");
    expect(panel).toContain("rejected");
    expect(panel).toContain("Submission is waiting for review");
    expect(panel).toContain("Rejected evidence still needs");
  });
});
