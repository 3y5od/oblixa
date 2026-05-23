import { StatusPill } from "@/components/ui/status-pill";
import type { StatTone } from "@/components/ui/stat-cell";

export type Severity = "low" | "medium" | "high" | "critical";

const TONE: Record<Severity, StatTone> = {
  low: "neutral",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

const LABEL: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export interface UiSeverityBadgeProps {
  severity: Severity | string;
  className?: string;
}

export function UiSeverityBadge({ severity }: UiSeverityBadgeProps) {
  const sev = (["low", "medium", "high", "critical"] as Severity[]).includes(
    severity as Severity
  )
    ? (severity as Severity)
    : ("low" as Severity);
  return <StatusPill tone={TONE[sev]}>{LABEL[sev]}</StatusPill>;
}
