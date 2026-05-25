/**
 * Documented keys inside `capacity_forecasts.forecast_json` (cron + API).
 * Team load uses `contract_tasks.team_key`. Approval pressure uses `contract_approvals.approval_type`.
 */
export const CAPACITY_FORECAST_JSON_KEYS = {
  open_tasks: "open_tasks",
  pending_approvals: "pending_approvals",
  open_decisions: "open_decisions",
  open_tasks_by_team_key: "open_tasks_by_team_key",
  pending_approvals_by_type: "pending_approvals_by_type",
  contracts_without_owner: "contracts_without_owner",
  delta_open_tasks_vs_prior_run: "delta_open_tasks_vs_prior_run",
  generated_at: "generated_at",
  interpretation: "interpretation",
} as const;
