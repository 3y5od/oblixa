import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §21.3 mutation feedback — recoverable errors on Core work actions", () => {
  it("work inline actions describe server failures in user-safe language", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/work/work-queue-inline-actions.tsx"),
      "utf8"
    );
    expect(raw).toContain("describeRecoverableMutationError");
    expect(raw).toContain("@/lib/recoverable-mutation-error");
  });

  it("recoverable mutation helper exports stable vocabulary for UI + telemetry", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/recoverable-mutation-error.ts"), "utf8");
    expect(raw.length).toBeGreaterThan(100);
    expect(raw.toLowerCase()).toMatch(/retry|again|network|permission|rate/i);
  });

  it("high-traffic review, onboarding, import, extraction, and contract mutations reuse recoverable mutation copy", () => {
    for (const rel of [
      "src/components/contracts/field-review.tsx",
      "src/components/dashboard/onboarding-banner.tsx",
      "src/components/contracts/contract-obligations-panel.tsx",
      "src/components/contracts/contract-table.tsx",
      "src/components/contracts/bulk-upload-form.tsx",
      "src/components/contracts/upload-more-files.tsx",
      "src/components/contracts/extract-button.tsx",
      "src/components/contracts/evidence-submission-form.tsx",
      "src/components/contracts/contracts-saved-view-create-form.tsx",
      "src/components/contracts/contract-notes-panel.tsx",
      "src/components/contracts/contract-tasks-panel.tsx",
      "src/components/contracts/add-field-form.tsx",
      "src/components/contracts/batch-approve-button.tsx",
      "src/components/contracts/renewal-checkpoints-panel.tsx",
    ]) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw, rel).toContain("describeRecoverableMutationError");
    }
  });

  it("uses inline status/alert (not toast) for work queue mutations — errors stay adjacent to controls", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/work/work-queue-inline-actions.tsx"),
      "utf8"
    );
    expect(raw).toContain('role={messageTone === "success" ? "status" : "alert"}');
    expect(raw).toContain("aria-live");
  });

  it("server actions emit visible_mutation_error telemetry on recoverable failures (pairs with inline UI)", () => {
    for (const rel of [
      "src/actions/tasks.ts",
      "src/actions/approvals.ts",
      "src/actions/obligations.ts",
      "src/actions/contracts.ts",
      "src/actions/exceptions.ts",
    ]) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw).toContain("emitVisibleMutationErrorTelemetry");
    }
  });
});
