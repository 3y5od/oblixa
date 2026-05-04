import { describe, expect, it } from "vitest";
import { getV10CommandJobHref, getV10WorkItemHref } from "./v10-job-routing";

describe("v10-job-routing", () => {
  it("routes command-palette import and export jobs to recovery or diagnostics by retryability", () => {
    expect(getV10CommandJobHref({ recordType: "import_job", recordId: "import_1", retryAction: "retry" })).toBe(
      "/contracts/bulk#recent-imports"
    );
    expect(getV10CommandJobHref({ recordType: "export_job", recordId: "export_1", retryAction: null })).toBe(
      "/settings/health#exports"
    );
  });

  it("routes report runs to recovery control room or diagnostic history", () => {
    expect(getV10CommandJobHref({ recordType: "report_run", recordId: "report_1", retryAction: "retry" })).toBe(
      "/reports"
    );
    expect(getV10CommandJobHref({ recordType: "report_run", recordId: "report_1", retryAction: null })).toBe(
      "/contracts/reports?runId=report_1"
    );
  });

  it("routes failed-job work items using their primary action", () => {
    expect(
      getV10WorkItemHref({
        type: "import_failure",
        sourceId: "import_1",
        contractId: null,
        primaryAction: "retry_failed_job",
      })
    ).toBe("/contracts/bulk#recent-imports");
    expect(
      getV10WorkItemHref({
        type: "report_failure",
        sourceId: "report_1",
        contractId: null,
        primaryAction: "open_source_object",
      })
    ).toBe("/contracts/reports?runId=report_1");
  });
});