import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { isFeatureEnabled, type FeatureFlagKey } from "@/lib/feature-flags";

export function assertV6PageFeature(flag: FeatureFlagKey): void {
  if (!isFeatureEnabled(flag)) notFound();
}

export function assertAnyV6PageFeature(flags: FeatureFlagKey[]): void {
  if (!flags.some((flag) => isFeatureEnabled(flag))) notFound();
}

export function v6ApiForbidden() {
  return NextResponse.json(
    { error: "This V6 feature is disabled for your workspace." },
    { status: 403 }
  );
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
