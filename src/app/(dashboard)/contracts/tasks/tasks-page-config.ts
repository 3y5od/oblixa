import type { StatTone } from "@/components/ui/stat-cell";
import type { TaskStatusFilter } from "@/app/(dashboard)/contracts/tasks/tasks-page-types";

export const STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Needs input" },
  { value: "done", label: "Done" },
];

export function taskStatusTone(status: string): StatTone {
  if (status === "done") return "success";
  if (status === "blocked") return "danger";
  if (status === "in_progress") return "neutral";
  if (status === "open") return "warning";
  return "neutral";
}

export function taskStatusLabel(status: string): string {
  if (status === "in_progress") return "In progress";
  if (status === "blocked") return "Needs input";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
