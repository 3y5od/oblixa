import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lightweight import smoke so refactors do not drop V9-critical entry points.
 * Deeper behavioral coverage lives next to each surface (e.g. *.ui.test.tsx, route tests).
 */
describe("V9 acceptance bundle (import smoke)", () => {
  it("keeps mutation recovery, lifecycle visibility, and renewal checklist actions wired", async () => {
    const err = await import("./recoverable-mutation-error");
    expect(typeof err.describeRecoverableMutationError).toBe("function");
    expect(err.describeRecoverableMutationError("Request timed out")).toContain("took too long");

    const evidenceDisplay = await import("./evidence-display");
    expect(typeof evidenceDisplay.getEvidenceRequirementStatusLabel).toBe("function");

    const tasks = await import("@/actions/tasks");
    expect(typeof tasks.createCheckpointClarificationTask).toBe("function");

    const renewal = await import("@/actions/renewal-playbook");
    expect(typeof renewal.seedRenewalPlaybook).toBe("function");

    const prov = await import("./v9-field-provenance");
    expect(typeof prov.fieldReviewProvenanceLabel).toBe("function");

    const importVisibility = await import("./import-job-visibility");
    expect(
      importVisibility.getImportJobHeadline({
        status: "queued",
        total_rows: 10,
        inserted_rows: 0,
        error_rows: 0,
      })
    ).toBe("Import is queued");

    const exportVisibility = await import("./export-job-visibility");
    expect(
      exportVisibility.getExportJobHeadline({
        status: "queued",
        selected_contract_count: 10,
        exported_rows: 0,
        truncated: false,
      })
    ).toBe("Export is queued");

    const importRetry = await import("@/components/contracts/import-job-retry-button");
    expect(typeof importRetry.ImportJobRetryButton).toBe("function");
  });

  it("keeps P0 e2e resilience and adversarial specs present", () => {
    const e2e = path.join(process.cwd(), "e2e");
    for (const f of [
      "ui-resilience.spec.ts",
      "ui-resilience-api.spec.ts",
      "url-adversarial.spec.ts",
      "auth-workflow-matrix.spec.ts",
      "public-route-h1-contract.spec.ts",
      "ui-qa-upload-emulation-perf.spec.ts",
      "ui-qa-http-client-status-mocks.spec.ts",
      "ui-qa-skip-lab-tiers.spec.ts",
      "manual-harness-limits.spec.ts",
    ]) {
      expect(fs.existsSync(path.join(e2e, f)), `e2e/${f} exists`).toBe(true);
    }
  });
});
