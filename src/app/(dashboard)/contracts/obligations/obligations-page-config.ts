import type { StatTone } from "@/components/ui/stat-cell";
import type { ObligationStatusFilter } from "@/app/(dashboard)/contracts/obligations/obligations-page-types";

export const STATUS_FILTERS: { value: ObligationStatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "waived", label: "Waived" },
];

export function statusToneFor(status: string): StatTone {
  if (status === "done") return "success";
  if (status === "waived") return "neutral";
  if (status === "in_progress") return "neutral";
  return "warning";
}

export function statusLabelFor(status: string): string {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  if (status === "waived") return "Waived";
  if (status === "open") return "Open";
  return status.replace("_", " ");
}
