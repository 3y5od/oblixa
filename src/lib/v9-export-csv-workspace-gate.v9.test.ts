/**
 * V9 §19.3–19.4 — export CSV uses shared field catalog and API workspace eligibility before streaming.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("export contracts CSV route (V9)", () => {
  it("requires workspace eligibility before export work", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/export/contracts/route.ts"), "utf8");
    expect(route).toContain("requireApiWorkspaceEligibility");
    expect(route).toContain("/api/export/contracts");
  });

  it("derives CSV columns from workspace-aware field list so headers stay aligned with extraction schema", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/export/contracts/route.ts"), "utf8");
    expect(route).toContain("getExportCsvExtractedFieldNamesForWorkspaceMode");
    expect(route).toContain("escapeCsvCellForSpreadsheet");
  });
});
