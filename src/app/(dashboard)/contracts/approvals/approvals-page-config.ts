import type { StatTone } from "@/components/ui/stat-cell";

export const APPROVAL_STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes requested" },
];

export function formatOperatorLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .trim();
}

export function approvalStatusTone(status: string): StatTone {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "changes_requested") return "warning";
  if (status === "pending") return "warning";
  return "neutral";
}
