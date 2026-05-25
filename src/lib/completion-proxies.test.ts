import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_SPEC_TRACE } from "./compatibility-spec-trace-map";

/**
 * §30 proxy — presence of Tier A–C bundles (no human signoff claim).
 */
describe("V9 completion proxies", () => {
  it("trace matrix covers the full v9.md heading set", () => {
    expect(Object.keys(V9_SPEC_TRACE).length).toBeGreaterThanOrEqual(145);
  });

  it("§30.1–30.10 each maps to a concrete proxy artifact (table-driven)", () => {
    const rows: { id: string; files: string[] }[] = [
      { id: "30.1", files: ["e2e/onboarding-calibration.spec.ts", "src/actions/onboarding-calibration.ts"] },
      { id: "30.2", files: ["src/components/dashboard/dashboard-upper.tsx", "src/lib/autonomous-plan-surfaces.test.ts"] },
      { id: "30.3", files: ["src/components/contracts/contract-table.tsx", "src/app/(dashboard)/contracts/[id]/page.tsx"] },
      { id: "30.4", files: ["src/components/contracts/field-review.tsx", "src/lib/review-feedback.test.ts"] },
      { id: "30.5", files: ["src/components/work/work-queue-inline-actions.tsx", "src/app/api/evidence/[id]/[action]/route.ts"] },
      {
        id: "30.6",
        files: [
          "src/app/(dashboard)/error.tsx",
          "src/app/(marketing)/error.tsx",
          "src/lib/client-exception-capture.test.ts",
          "src/lib/recoverable-mutation-error.ts",
        ],
      },
      { id: "30.7", files: ["src/lib/job-lifecycle-copy.ts", "src/lib/data-freshness.ts"] },
      { id: "30.8", files: ["src/lib/autonomous-plan-surfaces.test.ts", "src/lib/spec-principles.test.ts"] },
      { id: "30.9", files: ["src/components/layout/page-load-reporter.tsx", "src/lib/client-telemetry-strictmode.test.ts"] },
      { id: "30.10", files: ["src/lib/plan-enforcement-bundles.test.ts", "src/lib/global-constraints.test.ts"] },
    ];
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      for (const f of row.files) {
        expect(existsSync(join(process.cwd(), f)), `§${row.id} → ${f}`).toBe(true);
      }
    }
  });

  it("wiring and acceptance anchor files exist on disk", () => {
    const must = [
      "src/lib/product-telemetry.wiring.test.ts",
      "src/lib/acceptance-criteria.test.ts",
      "src/lib/acceptance-scripts-sync.test.ts",
      "src/lib/regression-bridge.test.ts",
      "src/lib/plan-enforcement-bundles.test.ts",
      "src/lib/autonomous-plan-surfaces.test.ts",
      "src/lib/global-constraints.test.ts",
      "src/lib/engineering-hygiene.test.ts",
      "e2e/compatibility-core-smoke.spec.ts",
      "e2e/compatibility-visual-optional.spec.ts",
      "src/lib/meta-scope-s1-s6.test.ts",
      "src/lib/client-exception-capture.test.ts",
      "src/lib/exception-audit-trail-nonclutter.test.ts",
      "src/lib/csv-formula-safe.test.ts",
      "src/lib/notification-deeplink-matrix.test.ts",
      "src/lib/onboarding-recovery-copy.test.ts",
      "src/lib/skip-link-landmarks.test.ts",
      "src/lib/onboarding-banner-activation-path.test.ts",
      "src/lib/api-critical-routes-matrix.test.ts",
      "src/lib/dashboard-no-dangerous-html.test.ts",
      "src/lib/in-app-notification-display.test.ts",
      "src/lib/dashboard-home-composition.test.ts",
      "src/lib/contracts-list-surface.test.ts",
      "src/lib/compatibility-dashboard-persona-density.test.ts",
      "src/lib/user-generated-content-surfaces.test.ts",
      "src/lib/review-queue-surface.test.ts",
      "src/lib/compatibility-work-queue-surface.test.ts",
      "src/lib/renewals-surface.test.ts",
      "src/lib/exceptions-surface.test.ts",
      "src/lib/compatibility-evidence-studio-surface.test.ts",
      "src/lib/form-preserve-on-reject.test.ts",
      "src/lib/product-telemetry-client-nonblocking.test.ts",
      "src/lib/plan-enforcement-read-nav.test.ts",
      "src/lib/api-client-errors.test.ts",
      "src/lib/contracts-url-and-params.test.ts",
      "src/lib/export-csv-workspace-gate.test.ts",
      "src/lib/export-csv-core-column-suppression.test.ts",
      "src/lib/route-metadata-core-anchors.test.ts",
      "src/lib/contracts-lifecycle-surface.test.ts",
      "src/lib/tasks-obligations-distinct-language.test.ts",
      "src/lib/deep-link-query-encoding.test.ts",
      "src/lib/execution-engine-bridge.test.ts",
      "src/lib/review-cadence-vs-queue-labels.test.ts",
      "src/lib/empty-state-cta-primitive.test.ts",
      "src/lib/upload-import-http-error-copy.test.ts",
      "src/lib/search-cmdk-surface.test.ts",
      "src/lib/import-export-surfaces.test.ts",
      "src/app/api/import-export-job-org-scope.test.ts",
      "src/app/api/import-contracts-job-post-retry.test.ts",
      "src/lib/empty-states-high-traffic.test.ts",
      "src/lib/mutation-feedback-surface.test.ts",
      "src/lib/revalidate-cache-stability.test.ts",
      "src/lib/errors-recovery-surface.test.ts",
      "src/lib/contracts-subroutes-not-found-matrix.test.ts",
      "src/lib/performance-page-load-surface.test.ts",
      "src/lib/consistency-vocabulary-core.test.ts",
      "src/lib/contract-table-a11y-responsive.test.ts",
      "src/lib/non-goals-guardrails-s31-s32.test.ts",
      "src/lib/auditability-actions-28-3.test.ts",
      "src/lib/regression-acceptance-anchors.test.ts",
      "src/lib/measurable-proxies-anchor.test.ts",
      "src/lib/manual-smoke-automation-bridge.test.ts",
      "src/lib/appendix-verbatim-anchors.test.ts",
      "src/lib/supabase-050-read-write-ui.test.ts",
      "src/lib/telemetry-tier-c-paths.test.ts",
      "src/lib/virtualization-selection-invariants.test.ts",
      "src/lib/cross-surface-contract-status-labels.test.ts",
      "src/lib/extraction-job-alert-states.test.ts",
      "src/lib/product-telemetry-swallow-errors.test.ts",
      "src/lib/permission-eligibility-work-queue.test.ts",
      "src/lib/rollout-inline-queue-kill-switch.test.ts",
      "src/lib/rollout-public-env-inventory.test.ts",
      "src/lib/export-job-visibility.test.ts",
      "src/lib/forbidden-hidden-family-core.test.ts",
      "src/lib/optimistic-mutation-inventory.test.ts",
      "src/lib/sparse-records.test.ts",
      "scripts/check-previous-release-suite.mjs",
    ];
    for (const rel of must) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});
