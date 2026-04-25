import type { V9_MANUAL_SMOKE_PATHS } from "./v9-manual-smoke-matrix";

/**
 * Primary `docs/v9.md` `##` section anchor for each manual smoke path (crosswalk: no orphans).
 */
export const V9_MANUAL_SMOKE_PRIMARY_SECTION: Record<(typeof V9_MANUAL_SMOKE_PATHS)[number], string> = {
  "first-value onboarding empty → dashboard usefulness": "7",
  "upload/import partial failure + retry": "17",
  "extraction fail → retry → stale banner": "17",
  "review save-and-next + downstream messaging": "11",
  "work inline complete/approve + refresh coherence": "12",
  "renewal clarification + seed playbook": "13",
  "exception resolve/reopen": "14",
  "evidence submit/reject/resubmit": "15",
  "quick-open contract + zero results": "16",
  "export rate limit / row budget messaging": "19",
  "multi-tab return + visibility refresh": "23",
  "least-privilege vs editor on bulk export": "3",
  "import retry + evidence review — HTTP 429/413 user copy": "22",
};
