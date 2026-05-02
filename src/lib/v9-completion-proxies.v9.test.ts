import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_SPEC_TRACE } from "./v9-spec-trace-map";

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
      { id: "30.2", files: ["src/components/dashboard/dashboard-upper.tsx", "src/lib/v9-autonomous-plan-surfaces.v9.test.ts"] },
      { id: "30.3", files: ["src/components/contracts/contract-table.tsx", "src/app/(dashboard)/contracts/[id]/page.tsx"] },
      { id: "30.4", files: ["src/components/contracts/field-review.tsx", "src/lib/review-feedback.v9.test.ts"] },
      { id: "30.5", files: ["src/components/work/work-queue-inline-actions.tsx", "src/app/api/evidence/[id]/[action]/route.ts"] },
      {
        id: "30.6",
        files: [
          "src/app/(dashboard)/error.tsx",
          "src/app/(marketing)/error.tsx",
          "src/lib/v9-client-exception-capture.v9.test.ts",
          "src/lib/recoverable-mutation-error.ts",
        ],
      },
      { id: "30.7", files: ["src/lib/v9-job-lifecycle-copy.ts", "src/lib/v9-data-freshness.ts"] },
      { id: "30.8", files: ["src/lib/v9-autonomous-plan-surfaces.v9.test.ts", "src/lib/v9-spec-principles.v9.test.ts"] },
      { id: "30.9", files: ["src/components/layout/v9-page-load-reporter.tsx", "src/lib/v9-client-telemetry-strictmode.v9.test.ts"] },
      { id: "30.10", files: ["src/lib/v9-plan-enforcement-bundles.v9.test.ts", "src/lib/v9-global-constraints.v9.test.ts"] },
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
      "src/lib/product-telemetry.wiring.v9.test.ts",
      "src/lib/v9-acceptance-criteria.test.ts",
      "src/lib/v9-acceptance-scripts-sync.v9.test.ts",
      "src/lib/v9-regression-bridge.v9.test.ts",
      "src/lib/v9-plan-enforcement-bundles.v9.test.ts",
      "src/lib/v9-autonomous-plan-surfaces.v9.test.ts",
      "src/lib/v9-global-constraints.v9.test.ts",
      "src/lib/v9-engineering-hygiene.v9.test.ts",
      "e2e/v9-core-smoke.spec.ts",
      "e2e/v9-visual-optional.spec.ts",
      "src/lib/v9-meta-scope-s1-s6.v9.test.ts",
      "src/lib/v9-client-exception-capture.v9.test.ts",
      "src/lib/v9-exception-audit-trail-nonclutter.v9.test.ts",
      "src/lib/csv-formula-safe.v9.test.ts",
      "src/lib/v9-notification-deeplink-matrix.v9.test.ts",
      "src/lib/v9-onboarding-recovery-copy.v9.test.ts",
      "src/lib/v9-skip-link-landmarks.v9.test.ts",
      "src/lib/v9-onboarding-banner-activation-path.v9.test.ts",
      "src/lib/v9-api-critical-routes-matrix.v9.test.ts",
      "src/lib/v9-dashboard-no-dangerous-html.v9.test.ts",
      "src/lib/in-app-notification-display.v9.test.ts",
      "src/lib/v9-dashboard-home-composition.v9.test.ts",
      "src/lib/v9-contracts-list-surface.v9.test.ts",
      "src/lib/v9-dashboard-persona-density.v9.test.ts",
      "src/lib/v9-user-generated-content-surfaces.v9.test.ts",
      "src/lib/v9-review-queue-surface.v9.test.ts",
      "src/lib/v9-work-queue-surface.v9.test.ts",
      "src/lib/v9-renewals-surface.v9.test.ts",
      "src/lib/v9-exceptions-surface.v9.test.ts",
      "src/lib/v9-evidence-studio-surface.v9.test.ts",
      "src/lib/v9-form-preserve-on-reject.v9.test.ts",
      "src/lib/v9-product-telemetry-client-nonblocking.v9.test.ts",
      "src/lib/v9-plan-enforcement-read-nav.v9.test.ts",
      "src/lib/v9-api-client-errors.v9.test.ts",
      "src/lib/v9-contracts-url-and-params.v9.test.ts",
      "src/lib/v9-export-csv-workspace-gate.v9.test.ts",
      "src/lib/v9-export-csv-core-column-suppression.v9.test.ts",
      "src/lib/v9-route-metadata-core-anchors.v9.test.ts",
      "src/lib/v9-contracts-lifecycle-surface.v9.test.ts",
      "src/lib/v9-tasks-obligations-distinct-language.v9.test.ts",
      "src/lib/v9-deep-link-query-encoding.v9.test.ts",
      "src/lib/v9-v4-execution-engine-bridge.v9.test.ts",
      "src/lib/v9-review-cadence-vs-queue-labels.v9.test.ts",
      "src/lib/v9-empty-state-cta-primitive.v9.test.ts",
      "src/lib/v9-upload-import-http-error-copy.v9.test.ts",
      "src/lib/v9-search-cmdk-surface.v9.test.ts",
      "src/lib/v9-import-export-surfaces.v9.test.ts",
      "src/app/api/import-export-job-org-scope.v9.test.ts",
      "src/app/api/import-contracts-job-post-retry.v9.test.ts",
      "src/lib/v9-empty-states-high-traffic.v9.test.ts",
      "src/lib/v9-mutation-feedback-surface.v9.test.ts",
      "src/lib/v9-revalidate-cache-stability.v9.test.ts",
      "src/lib/v9-errors-recovery-surface.v9.test.ts",
      "src/lib/contracts-subroutes-not-found-matrix.v9.test.ts",
      "src/lib/v9-performance-page-load-surface.v9.test.ts",
      "src/lib/v9-consistency-vocabulary-core.v9.test.ts",
      "src/lib/v9-contract-table-a11y-responsive.v9.test.ts",
      "src/lib/v9-non-goals-guardrails-s31-s32.v9.test.ts",
      "src/lib/v9-auditability-actions-28-3.v9.test.ts",
      "src/lib/v9-regression-acceptance-anchors.v9.test.ts",
      "src/lib/v9-measurable-proxies-anchor.v9.test.ts",
      "src/lib/v9-manual-smoke-automation-bridge.v9.test.ts",
      "src/lib/v9-appendix-verbatim-anchors.v9.test.ts",
      "src/lib/v9-supabase-050-read-write-ui.v9.test.ts",
      "src/lib/v9-telemetry-tier-c-paths.v9.test.ts",
      "src/lib/v9-virtualization-selection-invariants.v9.test.ts",
      "src/lib/v9-cross-surface-contract-status-labels.v9.test.ts",
      "src/lib/v9-extraction-job-alert-states.v9.test.ts",
      "src/lib/v9-product-telemetry-swallow-errors.v9.test.ts",
      "src/lib/v9-permission-eligibility-work-queue.v9.test.ts",
      "src/lib/v9-rollout-inline-queue-kill-switch.v9.test.ts",
      "src/lib/v9-rollout-public-env-inventory.v9.test.ts",
      "src/lib/export-job-visibility.v9.test.ts",
      "src/lib/v9-forbidden-hidden-family-core.v9.test.ts",
      "src/lib/v9-optimistic-mutation-inventory.v9.test.ts",
      "src/lib/v9-sparse-records.v9.test.ts",
      "scripts/check-v9-suite.mjs",
    ];
    for (const rel of must) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});
