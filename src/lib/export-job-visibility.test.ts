import { describe, expect, it } from "vitest";
import { getExportJobDetail, getExportJobHeadline, getExportJobTone } from "./export-job-visibility";
import { V9_OUTCOME_LABELS } from "./outcome-semantics";

describe("export job visibility (V9 outcome semantics)", () => {
  it("uses shared partial label for partial / truncated exports", () => {
    expect(
      getExportJobHeadline({
        status: "partial",
        selected_contract_count: 10,
        exported_rows: 3,
        truncated: false,
      })
    ).toBe(`Export finished — ${V9_OUTCOME_LABELS.partial}`);
  });

  it("§19.3 explains row-budget truncation distinctly from generic partial completion", () => {
    expect(
      getExportJobDetail({
        status: "partial",
        selected_contract_count: 100,
        exported_rows: 20000,
        truncated: true,
      })
    ).toContain("row budget");

    expect(
      getExportJobDetail({
        status: "partial",
        selected_contract_count: 10,
        exported_rows: 3,
        truncated: false,
      })
    ).toContain("limited");
    expect(
      getExportJobDetail({
        status: "partial",
        selected_contract_count: 10,
        exported_rows: 3,
        truncated: false,
      })
    ).not.toContain("row budget");
  });

  it("treats partial and processing exports as attention states", () => {
    expect(
      getExportJobTone({
        status: "partial",
        selected_contract_count: 10,
        exported_rows: 3,
        truncated: false,
      })
    ).toBe("attention");
    expect(
      getExportJobTone({
        status: "processing",
        selected_contract_count: 10,
        exported_rows: 0,
        truncated: false,
      })
    ).toBe("attention");
  });

  it("distinguishes queued exports from in-progress CSV generation", () => {
    expect(
      getExportJobHeadline({
        status: "queued",
        selected_contract_count: 10,
        exported_rows: 0,
        truncated: false,
      })
    ).toBe("Export is queued");
    expect(
      getExportJobDetail({
        status: "queued",
        selected_contract_count: 10,
        exported_rows: 0,
        truncated: false,
      })
    ).toContain("Export queued");
    expect(
      getExportJobHeadline({
        status: "processing",
        selected_contract_count: 10,
        exported_rows: 0,
        truncated: false,
      })
    ).toBe("Export is building");
  });

  it("explains empty completed exports without implying failure", () => {
    expect(
      getExportJobDetail({
        status: "completed",
        selected_contract_count: 0,
        exported_rows: 0,
        truncated: false,
      })
    ).toContain("no rows matched");
  });
});
