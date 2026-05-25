import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/reports/page.tsx");
const SPEC = join(process.cwd(), "src/lib/reports/spec-strings.ts");

describe("reports release-state compliance", () => {
  it("renders the Core Reports export surface and removes report-pack framing", () => {
    const raw = readFileSync(PAGE, "utf8");
    const spec = readFileSync(SPEC, "utf8");
    expect(raw).toContain("loadReportsPageModel");
    expect(raw).toContain("REPORTS_PAGE_TITLE");
    expect(raw).toContain("REPORTS_EMPTY_STATE");
    expect(raw).toContain("REPORT_CONTENT_LABELS");
    for (const label of [
      "Upcoming renewals",
      "Notice deadlines",
      "Missing owners",
      "Missing key fields",
      "Open obligations",
      "Overdue work",
      "Exceptions by owner",
      "Evidence requests",
      "Contract inventory",
      "Review completeness",
    ]) {
      expect(spec).toContain(label);
    }
    expect(raw).toContain('href="/settings/health"');
    for (const forbidden of [
      "Operational reports",
      "Workspace reports",
      "Configure your first report pack",
      "Create report pack",
      "Saved report packs",
      "Sample output",
      "Delivery diagnostics",
      "ReportsAdvancedContent",
      "SamplePreviewCard",
      "landing-corner-ring",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });
});
