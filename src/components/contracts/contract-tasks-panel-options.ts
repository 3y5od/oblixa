import type { ContractTaskPriority, ContractTaskStatus } from "@/lib/types";

export const STATUS_OPTIONS: { value: ContractTaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Needs input" },
  { value: "done", label: "Done" },
];

export const PRIORITY_OPTIONS: { value: ContractTaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function priorityBadge(priority: ContractTaskPriority): string {
  if (priority === "high") return "border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]";
  if (priority === "low") return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[var(--text-secondary)]";
  return "border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] text-[var(--warning-ink)]";
}

export function statusBadge(status: ContractTaskStatus): string {
  if (status === "done") return "border-[color:color-mix(in_oklab,var(--success)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success)_10%,var(--surface))] text-[var(--success-ink)]";
  if (status === "blocked") return "border-[color:color-mix(in_oklab,var(--danger)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--danger)]";
  if (status === "in_progress") return "border-[color:color-mix(in_oklab,var(--accent)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent)_10%,var(--surface))] text-[var(--accent-strong)]";
  return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))] text-[var(--text-secondary)]";
}

export function taskStatusLabel(status: ContractTaskStatus): string {
  if (status === "blocked") return "needs input";
  return status.replace("_", " ");
}
