import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/reports/page.tsx");

describe("contracts/reports report-pack UI (V7 §13.6 / §14)", () => {
  it("filters report types with workspace mode helpers on the server", () => {
    const raw = readFileSync(PAGE, "utf8");
    expect(raw).toContain("eligibleReportTypeOptionsForWorkspaceMode");
    expect(raw).toContain("workspaceModeAllowsReportType");
  });
});
