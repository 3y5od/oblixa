import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { isFeatureEnabled, type FeatureFlagKey } from "@/lib/feature-flags";
import { jsonProblem } from "@/lib/http/problem";

export function assertV6PageFeature(flag: FeatureFlagKey): void {
  if (!isFeatureEnabled(flag)) notFound();
}

export function assertAnyV6PageFeature(flags: FeatureFlagKey[]): void {
  if (!flags.some((flag) => isFeatureEnabled(flag))) notFound();
}

export function v6ApiForbidden() {
  return jsonProblem(403, {
    error: "This assurance feature is disabled for your workspace.",
    code: "feature_disabled",
    diagnostic_id: "v6_feature_disabled",
  });
}

export function requireV6ApiFeature(flag: FeatureFlagKey): NextResponse | null {
  if (!isFeatureEnabled(flag)) return v6ApiForbidden();
  return null;
}

export function v6CronSkipped() {
  return NextResponse.json({ ok: true, skipped: true, reason: "feature_disabled" });
}

export function requireV6CronFeature(flag: FeatureFlagKey): NextResponse | null {
  if (!isFeatureEnabled(flag)) return v6CronSkipped();
  return null;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { assertAnyV6PageFeature as assertAnyPageFeature };
export { assertV6PageFeature as assertPageFeature };
export { requireV6ApiFeature as requireApiFeature };
export { requireV6CronFeature as requireCronFeature };
export { v6ApiForbidden as apiForbidden };
export { v6CronSkipped as cronSkipped };
// End version-name compatibility aliases.
