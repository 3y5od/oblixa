import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_MANUAL_SMOKE_PRIMARY_SECTION } from "./v9-manual-smoke-doc-anchors";
import { V9_MANUAL_SMOKE_PATHS } from "./v9-manual-smoke-matrix";

type SmokePath = (typeof V9_MANUAL_SMOKE_PATHS)[number];
type FileNeedle = readonly [file: string, needle: string];

/** Each human smoke line stays tied to at least one Vitest/e2e/source anchor (maximal automation bridge). */
const MANUAL_SMOKE_AUTOMATION_PROXIES: Record<SmokePath, readonly FileNeedle[]> = {
  "first-value onboarding empty → dashboard usefulness": [
    ["e2e/onboarding-calibration.spec.ts", "@onboarding"],
    ["src/components/dashboard/onboarding-banner.ui.test.tsx", "OnboardingBanner"],
  ],
  "upload/import partial failure + retry": [
    ["src/components/contracts/bulk-upload-form.ui.test.tsx", "maps recoverable failures"],
    ["src/components/contracts/import-job-retry-button.ui.test.tsx", "ImportJobRetryButton"],
  ],
  "extraction fail → retry → stale banner": [
    ["src/components/contracts/extraction-job-alert.tsx", "Extraction may be stuck"],
  ],
  "review save-and-next + downstream messaging": [
    ["src/lib/v9-review-queue-surface.v9.test.ts", "ReviewSaveNextTelemetryLink"],
  ],
  "work inline complete/approve + refresh coherence": [
    ["src/components/work/work-queue-inline-actions.ui.test.tsx", "mockRouter.refresh"],
  ],
  "renewal clarification + seed playbook": [
    ["src/lib/v9-acceptance-bundle.v9.test.ts", "seedRenewalPlaybook"],
    ["src/lib/renewal-next-action.v9.test.ts", "getRenewalNextAction"],
  ],
  "exception resolve/reopen": [
    ["src/components/contracts/exception-mutation-panels.ui.test.tsx", "reopenException"],
  ],
  "evidence submit/reject/resubmit": [
    ["src/components/contracts/evidence-submission-form.ui.test.tsx", "submit evidence"],
    ["src/components/contracts/evidence-submission-review-actions.ui.test.tsx", "EvidenceSubmissionReviewActions"],
  ],
  "quick-open contract + zero results": [["e2e/v9-core-smoke.spec.ts", "no matches found"]],
  "export rate limit / row budget messaging": [
    ["src/lib/export-job-visibility.v9.test.ts", "row budget"],
    ["src/app/api/export/contracts/route.test.ts", "429"],
  ],
  "multi-tab return + visibility refresh": [
    ["src/components/layout/refetch-on-window-focus.tsx", "visibilitychange"],
  ],
  "least-privilege vs editor on bulk export": [
    ["src/lib/v9-export-csv-workspace-gate.v9.test.ts", "requireApiWorkspaceEligibility"],
    ["src/app/api/import-export-job-org-scope.v9.test.ts", "organization_id"],
  ],
  "import retry + evidence review — HTTP 429/413 user copy": [
    ["src/lib/v9-api-client-errors.v9.test.ts", "413"],
    ["src/components/contracts/import-job-retry-button.ui.test.tsx", "429"],
  ],
} as const satisfies Record<SmokePath, readonly FileNeedle[]>;

/**
 * §14 / §30 — Human `V9_MANUAL_SMOKE_PATHS` cannot be auto-signed off.
 * This bundle only pins matrix shape and links the tagged `@v9` e2e anchor.
 */
describe("V9 manual smoke matrix — automation bridge (handoff proxy)", () => {
  it("exports the planned 13 distinct human smoke descriptors", () => {
    expect(V9_MANUAL_SMOKE_PATHS).toHaveLength(13);
    expect(new Set(V9_MANUAL_SMOKE_PATHS).size).toBe(13);
    for (const row of V9_MANUAL_SMOKE_PATHS) {
      expect(row.length).toBeGreaterThan(8);
    }
  });

  it("keeps v9-core-smoke as the tagged @v9 regression anchor for overlapping journeys", () => {
    const smoke = readFileSync(join(process.cwd(), "e2e", "v9-core-smoke.spec.ts"), "utf8");
    expect(smoke).toContain("@v9");
    expect(smoke).toContain("/onboarding/calibration");
    expect(smoke).toContain("/contracts/bulk");
    expect(smoke).toContain("no matches found");
    expect(smoke).toContain("/contracts/review");
    expect(smoke).toContain("/work");
    expect(smoke).toContain("/contracts/data-quality");
    expect(smoke).toContain("/contracts/reports");
  });

  it("keeps docs § crosswalk keys aligned with the 13 smoke strings", () => {
    expect(Object.keys(V9_MANUAL_SMOKE_PRIMARY_SECTION)).toHaveLength(13);
    for (const path of V9_MANUAL_SMOKE_PATHS) {
      const section = V9_MANUAL_SMOKE_PRIMARY_SECTION[path];
      expect(section, path).toMatch(/^\d+$/);
    }
  });

  it("maps every human smoke path to on-disk automated proxy anchors", () => {
    for (const path of V9_MANUAL_SMOKE_PATHS) {
      const proofs = MANUAL_SMOKE_AUTOMATION_PROXIES[path];
      expect(proofs?.length, path).toBeGreaterThan(0);
      for (const [rel, needle] of proofs) {
        const raw = readFileSync(join(process.cwd(), rel), "utf8");
        expect(raw, `${path} ← ${rel}`).toContain(needle);
      }
    }
  });
});
