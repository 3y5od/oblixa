/**
 * Executable checklist for manual smoke paths (V9 § manual-smoke-signoff / signoff-matrix).
 * Automated tests cannot replace these; track completion outside the repo if needed.
 */
export const V9_MANUAL_SMOKE_PATHS = [
  "first-value onboarding empty → dashboard usefulness",
  "upload/import partial failure + retry",
  "extraction fail → retry → stale banner",
  "review save-and-next + downstream messaging",
  "work inline complete/approve + refresh coherence",
  "renewal clarification + seed playbook",
  "exception resolve/reopen",
  "evidence submit/reject/resubmit",
  "quick-open contract + zero results",
  "export rate limit / row budget messaging",
  "multi-tab return + visibility refresh",
  "least-privilege vs editor on bulk export",
  "import retry + evidence review — HTTP 429/413 user copy",
] as const;

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { V9_MANUAL_SMOKE_PATHS as MANUAL_SMOKE_PATHS };
// End version-name compatibility aliases.
