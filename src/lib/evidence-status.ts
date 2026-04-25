export const EVIDENCE_GAP_STATUSES = ["required", "rejected"] as const;

export function isEvidenceGapStatus(status: string): boolean {
  return (EVIDENCE_GAP_STATUSES as readonly string[]).includes(status);
}
