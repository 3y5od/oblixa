import { describe, expect, it } from "vitest";
import {
  getImportJobDetail,
  getImportJobHeadline,
  getImportJobTone,
  importJobCanRetry,
} from "./import-job-visibility";

describe("import job visibility", () => {
  it("treats failed jobs as risky and retryable", () => {
    const job = {
      status: "failed",
      total_rows: 12,
      inserted_rows: 0,
      error_rows: 12,
      failure_reason: "Contract insert failed",
    };
    expect(getImportJobTone(job)).toBe("risk");
    expect(getImportJobHeadline(job)).toBe("Import failed");
    expect(getImportJobDetail(job)).toContain("Contract insert failed");
    expect(importJobCanRetry(job)).toBe(true);
  });

  it("treats completed mixed outcomes as attention but still retryable", () => {
    const job = {
      status: "completed",
      total_rows: 8,
      inserted_rows: 5,
      error_rows: 3,
    };
    expect(getImportJobTone(job)).toBe("attention");
    expect(getImportJobHeadline(job)).toBe("Import finished — Partial");
    expect(getImportJobDetail(job)).toContain("5/8 rows created");
    expect(importJobCanRetry(job)).toBe(true);
  });

  it("treats superseded jobs as informational and non-retryable", () => {
    const job = {
      status: "completed",
      total_rows: 8,
      inserted_rows: 5,
      error_rows: 3,
      superseded_by_job_id: "job-newer",
    };
    expect(getImportJobTone(job)).toBe("neutral");
    expect(getImportJobHeadline(job)).toBe("Import replaced by newer retry");
    expect(getImportJobDetail(job)).toContain("newer retry replaced");
    expect(importJobCanRetry(job)).toBe(false);
  });

  it("distinguishes queued intake from active processing", () => {
    const queued = {
      status: "queued",
      total_rows: 8,
      inserted_rows: 0,
      error_rows: 0,
    };
    const processing = {
      status: "processing",
      total_rows: 8,
      inserted_rows: 2,
      error_rows: 0,
    };
    expect(getImportJobTone(queued)).toBe("neutral");
    expect(getImportJobHeadline(queued)).toBe("Import is queued");
    expect(getImportJobDetail(queued)).toContain("queued");
    expect(getImportJobHeadline(processing)).toBe("Import is creating records");
  });
});
