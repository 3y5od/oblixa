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
  pulse = false,
}: {
  status: SemanticStatus;
  children: ReactNode;
  className?: string;
  /** When true, render a subtle slow attention pulse — used for stale states. */
  pulse?: boolean;
}) {
  return (
    <span
      className={`ui-status-badge align-middle ${STATUS_CLASS_MAP[status]} ${pulse ? "ui-status-badge-pulse" : ""} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

