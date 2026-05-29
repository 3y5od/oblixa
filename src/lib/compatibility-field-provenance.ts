/** Provenance line for an extracted field row (approved vs pending vs unknown). */
export function fieldReviewProvenanceLabel(input: {
  status: string;
  confidence?: number | null;
}): string {
  const st = input.status?.toLowerCase() ?? "";
  if (st === "approved") {
    const c =
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? ` at ${Math.round(Math.min(100, Math.max(0, input.confidence)))}% model confidence`
        : "";
    return `Approved operational value${c}.`;
  }
  if (st === "pending" || st === "in_review") {
    return "Extracted suggestion — not approved yet. Downstream reminders and renewals stay gated until you approve.";
  }
  if (st === "rejected") {
    return "Rejected during review — does not drive approved-date workflows.";
  }
  return "Unknown review state — treat as not trusted for automation.";
}
