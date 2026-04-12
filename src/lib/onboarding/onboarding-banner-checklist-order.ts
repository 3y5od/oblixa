/**
 * Reorder onboarding banner checklist rows from persisted calibration hints (docs/onboarding.md §6).
 */
export function checklistRowOrderFromSetupChecklist(
  checklist: string[] | undefined
): Array<"upload" | "review" | "approve"> {
  const defaultOrder: Array<"upload" | "review" | "approve"> = ["upload", "review", "approve"];
  if (!checklist?.length) return defaultOrder;
  const first = checklist[0];
  if (first === "compliance_alignment" || checklist.includes("compliance_alignment")) {
    return ["review", "upload", "approve"];
  }
  if (first === "review_fields") return ["review", "upload", "approve"];
  if (first === "bulk_import" || checklist.includes("bulk_import")) {
    return ["upload", "review", "approve"];
  }
  if (first === "organize_work") return ["approve", "upload", "review"];
  return defaultOrder;
}
