import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { FIELD_NAMES, type FieldName } from "@/lib/types";

/**
 * Extracted-field columns omitted from contract CSV exports in Core workspaces (V9 §19.4).
 * These map to commercial / cadence detail that stays available in Advanced+ exports and UI,
 * while Core operational exports emphasize dates, parties, and renewal drivers.
 */
export const EXPORT_CSV_OMITTED_EXTRACTED_FIELDS_CORE: readonly FieldName[] = [
  "fee_reference",
  "payment_cadence",
];

export function getExportCsvExtractedFieldNamesForWorkspaceMode(
  mode: WorkspaceProductMode | undefined
): readonly FieldName[] {
  const m = mode ?? "core";
  if (m !== "core") return FIELD_NAMES;
  const omit = new Set(EXPORT_CSV_OMITTED_EXTRACTED_FIELDS_CORE);
  return FIELD_NAMES.filter((n) => !omit.has(n));
}
