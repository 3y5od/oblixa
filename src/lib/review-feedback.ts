import type { ExtractedField } from "@/lib/types";

const CRITICAL_REVIEW_FIELDS = ["end_date", "renewal_date", "notice_window"] as const;
const CRITICAL_REVIEW_FIELD_LABELS: Record<(typeof CRITICAL_REVIEW_FIELDS)[number], string> = {
  end_date: "End date",
  renewal_date: "Renewal date",
  notice_window: "Notice window",
};

function isFieldValuePresent(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function fieldReviewPriority(field: Pick<ExtractedField, "field_name" | "status">): number {
  const isCritical = CRITICAL_REVIEW_FIELDS.includes(
    field.field_name as (typeof CRITICAL_REVIEW_FIELDS)[number]
  );
  if (isCritical && field.status === "pending") return 0;
  if (field.status === "pending") return 1;
  if (isCritical) return 2;
  return 3;
}

export function sortFieldsForReview(fields: ExtractedField[]): ExtractedField[] {
  return [...fields].sort((a, b) => {
    const priorityDelta = fieldReviewPriority(a) - fieldReviewPriority(b);
    if (priorityDelta !== 0) return priorityDelta;
    const aCritical = CRITICAL_REVIEW_FIELDS.includes(
      a.field_name as (typeof CRITICAL_REVIEW_FIELDS)[number]
    );
    const bCritical = CRITICAL_REVIEW_FIELDS.includes(
      b.field_name as (typeof CRITICAL_REVIEW_FIELDS)[number]
    );
    if (aCritical && bCritical && a.field_name !== b.field_name) {
      return CRITICAL_REVIEW_FIELDS.indexOf(
        a.field_name as (typeof CRITICAL_REVIEW_FIELDS)[number]
      ) - CRITICAL_REVIEW_FIELDS.indexOf(b.field_name as (typeof CRITICAL_REVIEW_FIELDS)[number]);
    }
    return a.field_name.localeCompare(b.field_name);
  });
}

export function getCriticalFieldReviewSummary(
  fields: Pick<ExtractedField, "field_name" | "status" | "field_value">[]
): { pendingLabels: string[]; missingLabels: string[] } {
  const byField = new Map<
    (typeof CRITICAL_REVIEW_FIELDS)[number],
    Pick<ExtractedField, "status" | "field_value">[]
  >();
  for (const key of CRITICAL_REVIEW_FIELDS) {
    byField.set(key, []);
  }
  for (const field of fields) {
    if (!CRITICAL_REVIEW_FIELDS.includes(field.field_name as (typeof CRITICAL_REVIEW_FIELDS)[number])) {
      continue;
    }
    byField.get(field.field_name as (typeof CRITICAL_REVIEW_FIELDS)[number])?.push({
      status: field.status,
      field_value: field.field_value,
    });
  }

  const pendingLabels: string[] = [];
  const missingLabels: string[] = [];
  for (const key of CRITICAL_REVIEW_FIELDS) {
    const rows = byField.get(key) ?? [];
    const hasTrustedValue = rows.some(
      (row) => (row.status === "approved" || row.status === "edited") && isFieldValuePresent(row.field_value)
    );
    const hasPending = rows.some((row) => row.status === "pending");
    if (hasPending) pendingLabels.push(CRITICAL_REVIEW_FIELD_LABELS[key]);
    if (!hasTrustedValue) missingLabels.push(CRITICAL_REVIEW_FIELD_LABELS[key]);
  }

  return { pendingLabels, missingLabels };
}

export function buildFieldReviewStatusMessage(params: {
  pendingCount: number;
  action?: "approved" | "rejected" | "edited";
  fieldLabel?: string;
}): string {
  const { pendingCount, action, fieldLabel } = params;
  const prefix = fieldLabel
    ? `${fieldLabel.charAt(0).toUpperCase()}${fieldLabel.slice(1)} `
    : "Field ";
  const remaining =
    pendingCount > 0
      ? `${pendingCount} field${pendingCount === 1 ? "" : "s"} remaining.`
      : "Review complete.";
  const verb =
    action === "approved"
      ? "approved"
      : action === "rejected"
        ? "marked unknown"
        : action === "edited"
          ? "updated"
          : null;
  if (verb) return `${prefix}${verb}. ${remaining}`;
  return `Saved. ${remaining}`;
}
