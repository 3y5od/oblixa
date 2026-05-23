import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/settings/health/page.tsx");
const DIAGNOSTICS = join(
  process.cwd(),
  "src/app/(dashboard)/settings/health/settings-health-diagnostics-sections.tsx"
);

describe("settings health visible impact and report posture (V9)", () => {
  it("surfaces impact-first health rows and no-sample reliability copy", () => {
    const raw = [readFileSync(PAGE, "utf8"), readFileSync(DIAGNOSTICS, "utf8")].join("\n");
    expect(raw).toContain("Workspace status");
    expect(raw).toContain("Recovery setup needed");
    expect(raw).toContain("Setup needed");
    expect(raw).not.toContain("Automated recovery needs setup");
    expect(raw).toContain("Other workflow issues");
    expect(raw).not.toContain("Mode-aware workspace workflows");
    expect(raw).toContain("No failed, blocked, overdue, or delayed workspace workflows are visible for this mode.");
    expect(raw).toContain("workflow check");
    expect(raw).toContain("are clear");
    expect(raw).toContain("HealthCheckRow");
    expect(raw).toContain("additional workflow check");
    expect(raw).not.toContain("HealthDistributionBar");
    expect(raw).not.toContain("HealthSummaryStat");
    expect(raw).toContain("SupportDiagnosticCell");
    expect(raw).toContain("SupportSampleTrack");
    // HealthRing donut removed in V10 aesthetic refresh — replaced by an "At a glance" stat panel
    // (see hero <aside aria-label="Workspace health overview"> in page.tsx).
    expect(raw).toContain("Workspace health overview");
    expect(raw).toContain("max-w-6xl");
    expect(raw).not.toContain("StatusMetadataItem");
    expect(raw).toContain("No report sample");
    expect(raw).toContain("No delivery sample");
    expect(raw).toContain("No report runs sampled");
    expect(raw).toContain("No deliveries sampled");
    expect(raw).not.toContain("No sample yet");
    expect(raw).toContain("Delivery sample");
    expect(raw).toContain("Report sample");
    expect(raw).not.toContain("Payload boundary");
    expect(raw).toContain("Latest successful report");
    expect(raw).toContain("Latest failed report");
    expect(raw).toContain("Review import history");
    expect(raw).toContain("Review contract exports");
    expect(raw).toContain("Review extraction follow-up");
    expect(raw).toContain("Direct recovery actions");
    expect(raw).toContain("ImportJobRetryButton");
    expect(raw).toContain("Retry report");
    expect(raw).toContain("formatPercentOrNoSample");
    expect(raw).not.toContain("? 100 :");
    expect(raw).not.toContain(".toFixed(1)");
    expect(raw).not.toContain("healthyItems.map((item) =>");
    expect(raw).toContain("failedImportJobs > 0");
    expect(raw).toContain("failedReportRuns > 0");
    expect(raw).toContain("staleExtractionJobs > 0");
    expect(raw).toContain("retryQueueDepth > 0");
  });
});
