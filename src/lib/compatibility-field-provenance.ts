/** Provenance line for a contract-detail row (confirmed vs pending vs unknown). */
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
    return `Confirmed operational value${c}.`;
  }
  if (st === "pending" || st === "in_review") {
    return "Suggested detail — not confirmed yet. Reminders and renewals stay gated until you confirm.";
  }
  if (st === "rejected") {
    return "Marked unknown during confirmation — does not drive confirmed-date workflows.";
  }
  return "Unknown confirmation state — treat as not trusted for reminders or reports.";
}
