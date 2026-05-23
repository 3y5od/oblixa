import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("reports export route", () => {
  it("guards report exports and emits spreadsheet-safe CSV", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/api/export/reports/route.ts"), "utf8");
    expect(raw).toContain("export async function GET");
    expect(raw).toContain("resolveReportKey");
    expect(raw).toContain("invalid_report_key");
    expect(raw).toContain("requireApiWorkspaceEligibility");
    expect(raw).toContain("rateLimitCheck");
    expect(raw).toContain("escapeCsvCellForSpreadsheet");
    expect(raw).toContain("contentDispositionAttachment");
    expect(raw).toContain('from("contract_export_jobs")');
  });
});
