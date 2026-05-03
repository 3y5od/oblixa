import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * v9 spec §13.2 — each renewal row must surface horizon, owner, stage, blockers,
 * exception involvement, missing evidence, and next recommended action.
 */
describe("V9 §13.2 renewal row signals (renewals/page.tsx)", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx"),
    "utf8"
  );

  it("surface exposes horizon (filter + key date + countdown), owner, and contract status", () => {
    expect(page).toContain("name=\"horizon\"");
    expect(page).toMatch(/Key date|Countdown/);
    expect(page).toContain(">Owner<");
    expect(page).toContain(">Status<");
  });

  it("row surfaces checklist / blockers / workspace stage (dependencies + stage)", () => {
    expect(page).toMatch(/>\s*Checklist\s*</);
    expect(page).toMatch(/>\s*Blockers\s*</);
    expect(page).toMatch(/>\s*Workspace\s*</);
    expect(page).toContain("workspaceStatus");
    expect(page).toContain("blocker");
  });

  it("row surfaces exception involvement and missing evidence counts", () => {
    expect(page).toContain("openExceptions");
    expect(page).toContain("open exception");
    expect(page).toContain("outstandingEvidence");
    expect(page).toContain("evidence item");
  });

  it("row surfaces next recommended action via renewal-next-action", () => {
    expect(page).toContain("getRenewalNextAction");
    expect(page).toContain("nextActionHref");
    expect(page).toContain("nextActionLabel");
    expect(page).toMatch(/>\s*Next action\s*</);
  });
});
