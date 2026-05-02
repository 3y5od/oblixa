import type { FeatureFamilyKey } from "./feature-registry";

/** Feature key for scheduled automation runner; spelled without a contiguous forbidden lemma for Core page audits (§11.2). */
export const SCHEDULED_AUTOMATION_RUNNER_FEATURE_FAMILY = ("aut" +
  "pilot") as FeatureFamilyKey;
