import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import {
  isFeatureEnabled,
  type FeatureFlagKey,
} from "@/lib/feature-flags";

/** Server component: 404 unless at least one of the flags is enabled. */
export function assertAnyV5PageFeature(flags: FeatureFlagKey[]): void {
  if (!flags.some((k) => isFeatureEnabled(k))) notFound();
}

export function v5ApiForbidden(): NextResponse {
  return NextResponse.json(
    { error: "This feature is disabled for your workspace." },
    { status: 403 }
  );
}

/** Returns a 403 response if the flag is off; otherwise null (caller continues). */
export function requireV5ApiFeature(flag: FeatureFlagKey): NextResponse | null {
  if (!isFeatureEnabled(flag)) return v5ApiForbidden();
  return null;
}

export function v5CronSkipped(): NextResponse {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "feature_disabled",
  });
}

/** Returns skip response if the flag is off; otherwise null. */
export function requireV5CronFeature(flag: FeatureFlagKey): NextResponse | null {
  if (!isFeatureEnabled(flag)) return v5CronSkipped();
  return null;
}

/** Server components: hide route when flag is off. */
export function assertV5PageFeature(flag: FeatureFlagKey): void {
  if (!isFeatureEnabled(flag)) notFound();
}
