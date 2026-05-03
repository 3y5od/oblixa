/**
 * onboarding spec traceability (§1–§24) — implementation anchors for reviewers.
 * Do not duplicate the spec here; map sections to code entry points.
 */
export const ONBOARDING_SPEC_IMPLEMENTATION_TRACE = {
  "§1-2": ["src/lib/onboarding/calibration-gate.ts", "src/actions/onboarding-calibration.ts"],
  "§3": ["src/lib/v6/org-settings.ts", "src/lib/product-surface/context.ts"],
  "§4": [
    "src/proxy.ts",
    "src/app/auth/callback/route.ts",
    "src/app/(dashboard)/onboarding/calibration/page.tsx",
    "src/components/onboarding/calibration-wizard.tsx",
  ],
  "§4.4": [
    "src/lib/onboarding/calibration-map.ts (coreFallbackV6Patch)",
    "src/lib/onboarding/calibration-blocking-minimal.ts (applyBlockingCalibrationMinimalSkip)",
    "src/actions/onboarding-calibration.ts",
    "src/lib/onboarding/calibration-stale-expiry.ts",
    "src/lib/onboarding/calibration-stale-run.ts",
    "src/app/api/cron/v6/onboarding-calibration-stale/route.ts (logV6Cron + orgs_scanned)",
    "src/lib/rate-limit.ts (onboardingCalibration* buckets + gate throttles)",
    "src/lib/onboarding/calibration-types.ts",
  ],
  "§5-10": [
    "src/lib/onboarding/calibration-zod.ts",
    "src/lib/onboarding/calibration-copy.ts",
    "src/lib/onboarding/calibration-map.ts (setupChecklist)",
  ],
  "§11": ["src/lib/onboarding/calibration-map.ts", "src/lib/onboarding/calibration-dimensions.ts"],
  "§12-13": ["src/lib/onboarding/calibration-map.ts"],
  "§14-15": [
    "src/components/onboarding/calibration-wizard.tsx",
    "src/app/(dashboard)/settings/product/page.tsx",
    "src/app/(dashboard)/settings/product/settings-product-calibration-summary.tsx",
    "src/app/(dashboard)/settings/product/settings-product-calibration-export.tsx",
    "src/lib/onboarding/calibration-stale-env.ts (stale cron env)",
  ],
  "§16": ["src/actions/onboarding-calibration.ts"],
  "§17-18": [
    "src/lib/product-surface/landing-eligibility.ts",
    "src/lib/product-surface/resolver.ts",
    "src/lib/product-surface/workspace-transition.ts",
  ],
  "§19-20": ["src/actions/onboarding-calibration.ts", "src/actions/product-surface-settings.ts"],
  "§21": [
    "src/lib/observability/sentry-scrub.ts",
    "src/components/onboarding/calibration-wizard.tsx",
    "src/components/dashboard/onboarding-banner.tsx",
    "src/lib/onboarding/calibration-wizard-step.ts",
    "src/components/onboarding/calibration-wizard.review.test.tsx",
  ],
  "§22": [
    "src/lib/onboarding/calibration-map.test.ts",
    "src/lib/onboarding/calibration-dimensions.test.ts",
    "src/lib/onboarding/onboarding-acceptance.test.ts",
    "src/components/onboarding/calibration-wizard-non-dismiss.test.ts",
    "src/lib/onboarding/onboarding-product-context-last-applied.test.ts",
    "src/lib/onboarding/onboarding-parse-compat.test.ts",
    "src/lib/onboarding/calibration-history-labels.test.ts",
    "src/lib/onboarding/setup-checklist-copy-parity.test.ts",
    "src/actions/onboarding-audit-inventory.test.ts",
    "src/actions/onboarding-calibration-server-invariants.test.ts",
    "src/app/(dashboard)/settings/product/settings-product-calibration-static.test.ts",
  ],
  "§23-24": [
    ".github/pull_request_template.md",
    "src/lib/onboarding/calibration-map.ts",
    "src/lib/onboarding/calibration-dimensions.ts",
    "src/actions/onboarding-calibration-edge.test.ts",
    "src/lib/onboarding/onboarding-calibration-source-order.test.ts",
    "src/actions/onboarding-calibration-workflow-static.test.ts",
  ],
} as const;
