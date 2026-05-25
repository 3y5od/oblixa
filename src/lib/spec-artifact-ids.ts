/** Stable artifact identifiers (not filesystem paths under docs/). */
export const SPEC_ARTIFACT_V10 = "spec:v10";
export const SPEC_ARTIFACT_V9_ARCHIVE = "spec:v9-archive";
export const OPS_ARTIFACT_RUNBOOK = "ops:v10-runbook";

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { OPS_ARTIFACT_RUNBOOK as OPS_ARTIFACT_V10_RUNBOOK };
export { SPEC_ARTIFACT_V9_ARCHIVE as SPEC_ARTIFACT_ARCHIVE };
// End version-name compatibility aliases.
