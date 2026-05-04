import { describe, expect, it } from "vitest";
import { getV10JobRetryUrl, statusForV10JobRetryOutcome } from "./v10-job-retry";

describe("v10 job retry helpers", () => {
  it("maps retry outcomes to stable HTTP statuses", () => {
    expect(statusForV10JobRetryOutcome("not_found")).toBe(404);
    expect(statusForV10JobRetryOutcome("job_not_retryable")).toBe(409);
    expect(statusForV10JobRetryOutcome("dependency_blocked")).toBe(424);
    expect(statusForV10JobRetryOutcome("validation_failed")).toBe(400);
    expect(statusForV10JobRetryOutcome("server_error")).toBe(500);
  });

  it("resolves concrete retry endpoints for retryable work items", () => {
    expect(getV10JobRetryUrl({ type: "import_failure", sourceId: "import_1" })).toBe("/api/import/contracts/import_1");
    expect(getV10JobRetryUrl({ type: "export_failure", sourceId: "export_1" })).toBe("/api/export/contracts/export_1");
    expect(getV10JobRetryUrl({ type: "report_failure", sourceId: "report_1" })).toBe("/api/report-runs/report_1/retry");
  });
});