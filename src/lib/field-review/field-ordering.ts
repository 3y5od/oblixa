import type { ExtractedField } from "@/lib/types";
import { FIELD_REVIEW_IMPORTANT_FIELD_ALIASES } from "./spec-strings";

/**
 * Field-ordering + important-field helpers shared by the field-review model and
 * the cross-page queue-signal loader. Lives in its own module so
 * `contract-review-stats.ts` can compute the queue's "next pending field" with
 * the EXACT ordering the active decision pane uses, without importing `model.ts`
 * (which imports `contract-review-stats.ts` — that would be a cycle).
 */

/** Humanizes a raw extracted-field name into sentence case (`renewal_date` →
 *  "Renewal date"). Only the first word is capitalized — detail names are object
 *  labels, not formal titles, so they follow the sentence-case house style. */
export function formatReviewFieldLabel(fieldName: string): string {
  const words = fieldName.split("_").filter(Boolean);
  if (words.length === 0) return fieldName;
  return words
    .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

/** Display label for a Core important field, or null when the field is not a
 *  tracked Core alias. */
export function getImportantFieldLabel(fieldName: string): string | null {
  const normalized = fieldName.toLowerCase();
  return (
    FIELD_REVIEW_IMPORTANT_FIELD_ALIASES.find((entry) =>
      entry.keys.some((key) => key.toLowerCase() === normalized)
    )?.label ?? null
  );
}

/** Lower rank = more important; non-aliased fields sort last. */
export function importantFieldRank(fieldName: string): number {
  const normalized = fieldName.toLowerCase();
  const index = FIELD_REVIEW_IMPORTANT_FIELD_ALIASES.findIndex((entry) =>
    entry.keys.some((key) => key.toLowerCase() === normalized)
  );
  return index === -1 ? FIELD_REVIEW_IMPORTANT_FIELD_ALIASES.length : index;
}

/** Minimal row shape the comparator needs — lets both full `ExtractedField`s and
 *  lightweight queue-signal rows sort identically. */
export interface PendingFieldOrderRow {
  field_name: string;
  created_at: string;
  id: string;
}

/** Canonical pending-field ordering: important alias rank, then oldest created,
 *  then id for stability. The single source of truth for "what's next". */
export function comparePendingFieldRows(a: PendingFieldOrderRow, b: PendingFieldOrderRow): number {
  const importantDelta = importantFieldRank(a.field_name) - importantFieldRank(b.field_name);
  if (importantDelta !== 0) return importantDelta;
  const createdDelta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (createdDelta !== 0) return createdDelta;
  return a.id.localeCompare(b.id);
}

export function comparePendingFieldsForReview(a: ExtractedField, b: ExtractedField): number {
  return comparePendingFieldRows(a, b);
}

/** Pending fields only, in canonical review order. */
export function sortPendingFieldsForReview(fields: ExtractedField[]): ExtractedField[] {
  return [...fields].filter((field) => field.status === "pending").sort(comparePendingFieldsForReview);
}
