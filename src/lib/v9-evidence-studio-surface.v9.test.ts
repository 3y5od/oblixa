import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §15 evidence — studio + submission affordances", () => {
  it("evidence studio page anchors requirements and submission flows", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/evidence-studio/page.tsx"),
      "utf8"
    );
    expect(raw.length).toBeGreaterThan(200);
    expect(raw).toContain("WorkspaceRequiredState");
    expect(raw).toContain("EmptyState");
    expect(raw).toContain("getEvidenceRequirementStatusLabel");
    expect(raw).toContain("getEvidenceRequirementTypeLabel");
    expect(raw).toMatch(/evidence|submission|request/i);
  });

  it("keeps evidence submission form module for uploads", () => {
    expect(
      readFileSync(
        join(process.cwd(), "src/components/contracts/evidence-submission-form.tsx"),
        "utf8"
      ).length
    ).toBeGreaterThan(120);
  });
});
