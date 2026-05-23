import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RENEWAL_ROW_LABELS } from "@/lib/renewals/spec-strings";

describe("renewals export route", () => {
  const raw = readFileSync(join(process.cwd(), "src/app/api/export/renewals/route.ts"), "utf8");

  it("uses guarded CSV export plumbing and release-state columns", () => {
    expect(raw).toContain("requireApiWorkspaceEligibility");
    expect(raw).toContain("rateLimitCheck");
    expect(raw).toContain("recordApiRouteAuditEvent");
    expect(raw).toContain("emitProductTelemetryEvent");
    expect(raw).toContain("escapeCsvCellForSpreadsheet");
    expect(raw).toContain("contentDispositionAttachment");
    expect(raw).toContain("loadRenewalsPageModel");
    for (const key of Object.keys(RENEWAL_ROW_LABELS)) {
      expect(raw).toContain(`RENEWAL_ROW_LABELS.${key}`);
    }
  });

  it("names the file and telemetry as a renewal report", () => {
    expect(raw).toContain("renewals-${today}.csv");
    expect(raw).toContain('export_type: "renewal_report"');
  });
});
