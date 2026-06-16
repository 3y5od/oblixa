import type { StatTone } from "@/components/ui/stat-cell";
import type { SeverityFilter, StatusFilter } from "@/app/(dashboard)/contracts/exceptions/exceptions-page-types";

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const STATUS_DISPLAY: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const SEVERITY_DISPLAY: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const EXCEPTION_TYPE_DISPLAY: Record<string, string> = {
  missing_critical_field: "Required information missing",
  missing_critical_dates: "Required dates missing",
  approval_sla_breach: "Approval SLA breach",
  obligation_overdue: "Contract requirement is overdue",
  escalation: "Manager escalation",
  policy_control: "Control breach",
  policy_escalation: "Control escalation",
};

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return (["", "open", "in_progress", "resolved", "closed"].includes(value ?? "")
    ? value
    : "") as StatusFilter;
}

export function parseSeverityFilter(value: string | undefined): SeverityFilter {
  return (["", "low", "medium", "high", "critical"].includes(value ?? "")
    ? value
    : "") as SeverityFilter;
}

export function displayEnumValue(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function displayExceptionEvent(value: string) {
  const labels: Record<string, string> = {
    detected: "Signal confirmed",
    assigned: "Owner routed",
    resolved: "Recovery closed",
    reopened: "Recovery reopened",
  };
  return labels[value] ?? displayEnumValue(value);
}

export function severityTone(severity: string): StatTone {
  if (severity === "critical") return "danger";
  if (severity === "high" || severity === "medium") return "warning";
  return "neutral";
}

export function statusTone(status: string): StatTone {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "open") return "warning";
  return "neutral";
}

export function severityMedallionClass(severity: string): string {
  if (severity === "critical") {
    return "border-[color:color-mix(in_oklab,var(--danger)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--danger-soft)_38%,var(--surface-raised))] text-[var(--danger-ink)]";
  }
  if (severity === "high" || severity === "medium") {
    return "border-[color:color-mix(in_oklab,var(--warning)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_38%,var(--surface-raised))] text-[var(--warning-ink)]";
  }
  return "border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] text-[var(--accent-strong)]";
}
