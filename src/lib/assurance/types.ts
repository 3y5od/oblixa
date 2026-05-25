export type V6Severity = "low" | "medium" | "high" | "critical";

export type V6FindingStatus = "open" | "in_review" | "resolved" | "dismissed";

export type V6PlaybookRunStatus =
  | "queued"
  | "previewed"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type V6AutopilotRunStatus = "dry_run" | "executed" | "blocked" | "failed" | "reverted";

export type V6ScorecardType = "team" | "account" | "segment" | "program" | "counterparty";

export type V6ReviewBoardType =
  | "weekly_portfolio_health"
  | "monthly_control_effectiveness"
  | "renewal_readiness"
  | "evidence_compliance"
  | "campaign_effectiveness"
  | "counterparty_risk";

// Version-name compatibility aliases. Prefer neutral exports in new code.
export type { V6AutopilotRunStatus as AutopilotRunStatus };
export type { V6FindingStatus as FindingStatus };
export type { V6PlaybookRunStatus as PlaybookRunStatus };
export type { V6ReviewBoardType as ReviewBoardType };
export type { V6ScorecardType as ScorecardType };
export type { V6Severity as Severity };
// End version-name compatibility aliases.
