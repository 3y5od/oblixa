/** Canonical lifecycle vocabulary for long-running jobs (V9 cancel/abandon/supersede/resume). */
export const V9_JOB_LIFECYCLE = {
  cancel: "Cancel stops the current attempt intentionally; it should not be treated as active work.",
  abandon:
    "Abandoned means the attempt was left without a confirmed terminal outcome (timeout, closed tab, or worker loss).",
  supersede:
    "Superseded means a newer retry or rerun replaced this attempt as the primary lineage users should act on.",
  resume: "Resume continues the same attempt when the platform can safely pick up prior progress.",
} as const;
