import type { ReactNode } from "react";

export type SemanticStatus =
  | "healthy"
  | "info"
  | "in_review"
  | "warning"
  | "blocked"
  | "overdue"
  | "critical"
  | "empty"
  | "disabled";

const STATUS_CLASS_MAP: Record<SemanticStatus, string> = {
  healthy: "ui-status-badge-healthy",
  info: "ui-status-badge-info",
  in_review: "ui-status-badge-in-review",
  warning: "ui-status-badge-warning",
  blocked: "ui-status-badge-blocked",
  overdue: "ui-status-badge-overdue",
  critical: "ui-status-badge-critical",
  empty: "ui-status-badge-empty",
  disabled: "ui-status-badge-disabled",
};

export function StatusBadge({
  status,
  children,
  className = "",
}: {
  status: SemanticStatus;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`ui-status-badge ${STATUS_CLASS_MAP[status]} ${className}`.trim()}>
      {children}
    </span>
  );
}

