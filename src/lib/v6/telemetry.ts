export {
  ASSURANCE_QUALITY_COUNTER_FIELDS,
  V6_QUALITY_COUNTER_FIELDS,
  incrementAssuranceQualityCounter,
  incrementV6QualityCounter,
  recordAssuranceActivity,
  recordAssuranceHubVisitor,
  recordV6AssuranceActivity,
} from "@/lib/assurance/telemetry";

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { incrementV6QualityCounter as incrementQualityCounter } from "@/lib/assurance/telemetry";
export { V6_QUALITY_COUNTER_FIELDS as QUALITY_COUNTER_FIELDS } from "@/lib/assurance/telemetry";
// End version-name compatibility aliases.
