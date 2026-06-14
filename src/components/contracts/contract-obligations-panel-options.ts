import type { ContractObligationStatus } from "@/lib/types";

export const STATUS_OPTIONS: { value: ContractObligationStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "waived", label: "Waived" },
];

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom_days", label: "Custom (days)" },
];

export const ESCALATION_OPTIONS = [
  { value: "none", label: "esc:none" },
  { value: "pending", label: "esc:pending" },
  { value: "sent", label: "esc:sent" },
  { value: "acked", label: "esc:acked" },
];

export function statusTone(status: ContractObligationStatus): string {
  if (status === "done") return "border-[color:color-mix(in_oklab,var(--success)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success)_10%,var(--surface))] text-[var(--success-ink)]";
  if (status === "waived") return "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] text-[var(--text-secondary)]";
  if (status === "in_progress") return "border-[color:color-mix(in_oklab,var(--accent)_38%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent)_10%,var(--surface))] text-[var(--accent-strong)]";
  return "border-[color:color-mix(in_oklab,var(--warning)_42%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning)_12%,var(--surface))] text-[var(--warning-ink)]";
}
