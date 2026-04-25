import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_SECTION_30_PREAMBLE_VERBATIM } from "./v9-section-30-preamble";

/**
 * Appendix A (plan) — verbatim phrases locked by tests must still exist in `docs/v9.md`.
 * When intentional doc edits remove text, update both docs and the corresponding test fixture.
 */
describe("V9 Appendix A verbatim doc anchors", () => {
  it("§30 preamble line stays synchronized with docs/v9.md", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8");
    expect(doc).toContain(V9_SECTION_30_PREAMBLE_VERBATIM);
  });

  it("§29.2 regression bullets from v9-plan-enforcement-bundles remain in docs/v9.md", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8");
    for (const phrase of [
      "workspace-mode containment",
      "route and action authorization behavior",
      "hidden-feature suppression",
      "notification eligibility controls",
    ]) {
      expect(doc).toContain(phrase);
    }
  });

  it("§27.2 reliability state vocabulary from v9-reliability-states-27-2 remains in docs/v9.md", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8").toLowerCase();
    for (const phrase of [
      "extraction in progress",
      "extraction failed",
      "import in progress",
      "import failed or partial",
      "reminder active",
      "reminder inactive due to missing approved dates",
      "report generation in progress",
      "report generation failed",
    ]) {
      expect(doc).toContain(phrase);
    }
  });
});
