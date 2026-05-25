/**
 * V9 §19.4 — Core contract CSV exports omit ineligible hidden-family extracted columns.
 */
import { describe, expect, it } from "vitest";
import { FIELD_NAMES } from "@/lib/types";
import {
  EXPORT_CSV_OMITTED_EXTRACTED_FIELDS_CORE,
  getExportCsvExtractedFieldNamesForWorkspaceMode,
} from "@/lib/export-contract-csv-field-policy";

describe("export CSV Core column suppression (V9 §19.4)", () => {
  it("omits a fixed commercial-detail subset in Core while preserving Advanced+ full catalog", () => {
    const core = getExportCsvExtractedFieldNamesForWorkspaceMode("core");
    const adv = getExportCsvExtractedFieldNamesForWorkspaceMode("advanced");
    expect(adv).toEqual(FIELD_NAMES);
    expect(core.length).toBe(FIELD_NAMES.length - EXPORT_CSV_OMITTED_EXTRACTED_FIELDS_CORE.length);
    for (const name of EXPORT_CSV_OMITTED_EXTRACTED_FIELDS_CORE) {
      expect(core.includes(name)).toBe(false);
      expect(adv.includes(name)).toBe(true);
    }
  });
});
