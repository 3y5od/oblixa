import { describe, expect, it } from "vitest";
import {
  containsDefaultSurfaceInternalTerm,
  humanizeOperationalToken,
  operationalActionLabel,
  operationalizeCopy,
} from "./operational-copy";

describe("operational-copy", () => {
  it("maps raw action keys to operator-facing labels", () => {
    expect(operationalActionLabel("assign_owner")).toBe("Assign owner");
    expect(operationalActionLabel("retry_failed_job")).toBe("Retry job");
    expect(operationalActionLabel("resolve_exception")).toBe("Resolve exception");
  });

  it("humanizes unknown raw tokens", () => {
    expect(humanizeOperationalToken("blocked_missing_approved_dates")).toBe(
      "Blocked Missing Approved Dates"
    );
  });

  it("rewrites implementation-first copy for default surfaces", () => {
    expect(operationalizeCopy("Review read-model diagnostics from the durable work index.")).toBe(
      "Review data freshness checks from the work queue."
    );
  });

  it("detects internal terms and raw enum labels", () => {
    expect(containsDefaultSurfaceInternalTerm("read-model diagnostics")).toBe(true);
    expect(containsDefaultSurfaceInternalTerm("retry_failed_job")).toBe(true);
    expect(containsDefaultSurfaceInternalTerm("Review failed jobs")).toBe(false);
  });
});
